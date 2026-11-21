"""Creates its own temporary migrated database; never resets the real İBB directory."""
import copy
import json
import os
from pathlib import Path
import uuid

import psycopg
from psycopg import sql
import pytest
from fastapi.testclient import TestClient

from src.app import create_app
from src.db import connect
from src.ibb_import import stage, make_plan, apply_plan, digest
from src.review_coordination import PostgresReviewCoordination
from tests.test_ibb_import import raw, feature

pytestmark = pytest.mark.skipif(os.getenv("SMARTLOO_TEST_POSTGIS") != "1", reason="Requires explicit test DB opt-in")


@pytest.fixture
def database():
    name = "smartloo_ibb_test_" + uuid.uuid4().hex[:12]
    maintenance_db = os.getenv("SMARTLOO_DB_NAME", "smartloo")
    with connect() as admin:
        admin.autocommit = True
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setenv("SMARTLOO_DB_NAME", name)
    try:
        with connect() as conn:
            for path in sorted(Path("db/migrations").glob("*.sql")):
                conn.execute(path.read_text(encoding="utf-8"))
        yield
    finally:
        monkeypatch.undo()
        with connect() as admin:
            admin.autocommit = True
            admin.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name)))


def test_reimport_keeps_ids_reviews_amenities_and_provenance(database):
    source = raw(feature(), feature(), feature("Yazlık", "Dönemlik"), feature("Kapalı", "Pasif"))
    plan = make_plan(source)
    first = apply_plan(source, plan, digest(plan))
    assert first["inserted"] == 3 and first["duplicate_rows"] == 1
    key = plan["targets"][plan["rows"][0]["source_id"]]
    with connect() as conn:
        conn.execute("UPDATE toilets SET average_cleanliness=4,review_count=2,review_version=8,is_free=true WHERE id=%s", (key,))
    second = apply_plan(source, plan, digest(plan))
    assert second["inserted"] == 0 and second["unchanged"] == 3
    assert make_plan(source)["targets"] == plan["targets"]
    with connect() as conn:
        row = conn.execute("SELECT * FROM toilets WHERE id=%s", (key,)).fetchone()
        assert (row["average_cleanliness"], row["review_count"], row["review_version"], row["is_free"]) == (4, 2, 8, True)
        assert conn.execute("SELECT count(*) AS n FROM external_import_runs").fetchone()["n"] == 2


def test_metadata_changes_update_but_dont_invent_amenities(database):
    source = raw(feature())
    plan = make_plan(source)
    apply_plan(source, plan, digest(plan))
    updated = feature(status="Pasif")
    new = raw(updated)
    proposed = make_plan(new)
    assert proposed["targets"] == plan["targets"]
    assert apply_plan(new, proposed, digest(proposed))["updated"] == 1
    with connect() as conn:
        row = conn.execute("SELECT * FROM toilets").fetchone()
        assert row["status"] == "CLOSED"
        assert all(row[k] is None for k in ("has_baby_changing", "has_disabled_access", "is_free", "price_try", "opening_hours"))


def test_rename_requires_reviewed_alias_and_preserves_uuid(database):
    source = raw(feature("Eski"))
    first = make_plan(source)
    apply_plan(source, first, digest(first))
    new = raw(feature("Yeni"))
    proposed = make_plan(new)
    assert proposed["possible_existing_matches"]
    # Editing the displayed hints cannot bypass live identity collision checks.
    proposed["possible_existing_matches"] = {}
    with pytest.raises(ValueError):
        apply_plan(new, proposed, digest(proposed))
    proposed["targets"] = {proposed["rows"][0]["source_id"]: next(iter(first["targets"].values()))}
    assert apply_plan(new, proposed, digest(proposed))["updated"] == 1
    with connect() as conn:
        assert conn.execute("SELECT count(*) AS n FROM toilets").fetchone()["n"] == 1
        assert conn.execute("SELECT count(*) AS n FROM external_source_identities").fetchone()["n"] == 2


def test_mid_batch_sql_failure_rolls_back_everything(database):
    source = raw(feature("Bir"), feature("İki", lon=29.01))
    plan = make_plan(source)
    with connect() as conn:
        conn.execute("""CREATE FUNCTION fail_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
            IF NEW.name='İki' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER test_fail_import BEFORE INSERT ON toilets FOR EACH ROW EXECUTE FUNCTION fail_import();""")
    with pytest.raises(psycopg.Error):
        apply_plan(source, plan, digest(plan))
    with connect() as conn:
        for table in ("toilets", "external_source_identities", "external_import_runs"):
            assert conn.execute(sql.SQL("SELECT count(*) AS n FROM {}").format(sql.Identifier(table))).fetchone()["n"] == 0


def test_pending_review_and_live_writer_block_import(database):
    source = raw(feature())
    plan = make_plan(source)
    apply_plan(source, plan, digest(plan))
    key = next(iter(plan["targets"].values()))
    with PostgresReviewCoordination().guard(key) as writer:
        with pytest.raises(ValueError):
            apply_plan(source, plan, digest(plan))
        writer.begin(str(uuid.uuid4()), None)
    with pytest.raises(ValueError):
        apply_plan(source, plan, digest(plan))


def test_directory_detail_and_nearby_unknown_semantics(database):
    with TestClient(create_app()) as client:
        assert client.get("/api/v1/toilets").status_code == 503
    source = raw(feature(), feature("Yazlık", "Dönemlik"), feature("Kapalı", "Pasif"))
    plan = make_plan(source)
    apply_plan(source, plan, digest(plan))
    with TestClient(create_app()) as client:
        directory = client.get("/api/v1/toilets")
        assert directory.status_code == 200
        assert directory.json()["count"] == 3
        assert directory.json()["filter_coverage"] == {"total": 3, "has_disabled_access": 0, "has_baby_changing": 0, "is_free": 0}
        assert directory.json()["source"]["license"] == "https://data.ibb.gov.tr/license"
        seasonal = next(r for r in directory.json()["results"] if r["source_status"] == "Dönemlik")
        assert seasonal["status"] is None and seasonal["is_open_now"] is None
        detail = client.get(f"/api/v1/toilets/{seasonal['id']}").json()
        assert detail["status"] is None and detail["is_open_now"] is None
        assert client.get("/api/v1/toilets", params={"open_now": True}).json()["count"] == 0
        assert client.get("/api/v1/toilets", params={"is_free": False}).json()["count"] == 0
        assert client.get("/api/v1/toilets", params={"is_free": False}).json()["filter_coverage"]["total"] == 3
        near = client.get("/api/v1/toilets/nearby", params={"lat": 41, "lon": 29, "radius":1000}).json()
        assert near["count"] == 3


def test_directory_filter_coverage_counts_known_false_and_true_before_filtering(database):
    source = raw(feature("Bir"), feature("İki"), feature("Üç"))
    plan = make_plan(source)
    apply_plan(source, plan, digest(plan))
    with connect() as conn:
        conn.execute("UPDATE toilets SET is_free=true, has_disabled_access=true WHERE name='Bir'")
        conn.execute("UPDATE toilets SET is_free=false, has_disabled_access=false,has_baby_changing=false WHERE name='İki'")
    with TestClient(create_app()) as client:
        data = client.get('/api/v1/toilets', params={"is_free": True}).json()
        assert [row["name"] for row in data["results"]] == ["Bir"]
        assert data["filter_coverage"] == {"total": 3, "has_disabled_access": 2, "has_baby_changing": 1, "is_free": 2}
