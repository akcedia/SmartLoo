import copy
import json
from pathlib import Path
import uuid
from unittest.mock import patch
from urllib.error import URLError

import pytest

from src.ibb_import import stage, digest, apply_plan, download


def feature(name="Örnek", status="Aktif", lon=29.0, lat=41.0):
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {"MAHAL_ADI": name, "ILCE": "KADIKÖY", "TUVALET_DURUM": status,
                           "BAKIM_ODASI": "Var", "X": lon, "Y": lat}}


def raw(*features):
    return json.dumps({"type": "FeatureCollection", "features": list(features)}, ensure_ascii=False).encode()


def plan_for(source):
    plan = stage(source)
    plan["targets"] = {r["source_id"]: str(uuid.uuid4()) for r in plan["rows"]}
    plan["possible_existing_matches"] = {}
    return plan


def test_source_semantics_and_exact_duplicate_provenance():
    f = feature()
    plan = stage(raw(f, f, feature("Kapalı", "Pasif"), feature("Yazlık", "Dönemlik")))
    assert (plan["source_rows"], plan["unique_rows"], plan["duplicate_rows"]) == (4, 3, 1)
    assert plan["rows"][0]["source_indexes"] == [0, 1]
    assert [r["status"] for r in plan["rows"]] == ["ACTIVE", "CLOSED", None]
    assert all(r["district"] == "Kadıköy" for r in plan["rows"])
    assert plan["rows"][0]["source_properties"]["BAKIM_ODASI"] == "Var"


def test_identity_retains_geometry_precision_beyond_sql_rounding():
    source = raw(feature())
    a = stage(source.replace(b'29.0', b'29.00000000000000001'))
    b = stage(source.replace(b'29.0', b'29.00000000000000002'))
    assert a["rows"][0]["source_id"] != b["rows"][0]["source_id"]


def test_reordering_preserves_identity():
    a, b = feature("Bir"), feature("İki", lon=29.01)
    assert {r["source_id"] for r in stage(raw(a, b))["rows"]} == {r["source_id"] for r in stage(raw(b, a))["rows"]}


def test_same_identity_different_metadata_is_not_silently_merged():
    a = feature()
    b = copy.deepcopy(a)
    b["properties"]["BAKIM_ODASI"] = "Yok"
    with pytest.raises(ValueError):
        stage(raw(a, b))


@pytest.mark.parametrize("source", [b'{}', raw(), b'{"type":"FeatureCollection","type":"bad","features":[]}',
                                    raw(feature(status="Bilinmeyen etiket")), raw(feature(lat=95))])
def test_invalid_or_empty_batch_rejected(source):
    with pytest.raises(ValueError):
        stage(source)


def test_changed_plan_or_source_never_reaches_database():
    source = raw(feature())
    plan = plan_for(source)
    approved = digest(plan)
    plan["rows"][0]["status"] = "CLOSED"
    with patch("src.ibb_import.connect", side_effect=AssertionError("must not connect")):
        with pytest.raises(ValueError):
            apply_plan(source, plan, approved)
        with pytest.raises(ValueError):
            apply_plan(source, plan, digest(plan))


def test_source_outage_never_calls_database():
    with patch("src.ibb_import.build_opener") as opener, patch("src.ibb_import.connect") as connect:
        opener.return_value.open.side_effect = URLError("offline")
        with pytest.raises(URLError):
            download()
        connect.assert_not_called()
