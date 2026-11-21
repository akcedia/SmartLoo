"""Real HTTP composition: SQL/Mongo writer and Redis cache, synthetic model only."""
import os
import uuid

import pytest
from fastapi.testclient import TestClient
import pymongo
import redis

from src.app import create_app
from src.ai_restricted_policy import POLICY_VERSION, expected_candidate
from src.db import connect
from src.review_coordination import PostgresReviewCoordination
from src.review_scores import ReviewStoreError

pytestmark = pytest.mark.skipif(
    os.getenv("SMARTLOO_TEST_POSTGIS") != "1" or os.getenv("SMARTLOO_TEST_MONGO") != "1"
    or not os.getenv("SMARTLOO_AI_TEST_REDIS_URL"), reason="Explicit three-store test setup required")
KEY = "summary-http-tests-only-at-least-32-byte-secret"


class TestProvider:
    __test__ = False

    def __init__(self):
        self.calls, self.evidence, self.hook = 0, [], None

    async def __call__(self, evidence):
        self.calls += 1
        self.evidence.append(evidence)
        hook, self.hook = self.hook, None
        if hook:
            await hook()
        return expected_candidate(evidence)


@pytest.fixture
def live(monkeypatch):
    marker = uuid.uuid4().hex
    facility = str(uuid.uuid4())
    mongo_name = f"summary_http_{marker}"
    monkeypatch.setenv("SMARTLOO_MONGO_DB", mongo_name)
    monkeypatch.setenv("SMARTLOO_REDIS_URL", os.environ["SMARTLOO_AI_TEST_REDIS_URL"])
    provider = TestProvider()
    app = create_app(ai_provider=provider, ai_profile=POLICY_VERSION, jwt_secret=KEY)
    emails, users, headers, review_ids = [], [], [], []
    cache = redis.Redis.from_url(os.environ["SMARTLOO_AI_TEST_REDIS_URL"], decode_responses=True)
    try:
        cache.ping()
        with connect() as conn:
            conn.execute("""INSERT INTO toilets(id,source,source_id,name,latitude,longitude,district,opening_hours)
                VALUES (%s,'summary-http-test',%s,'Summary test',41,29,'Kadıköy','24/7')""", (facility, marker))
        with TestClient(app) as client:
            for i in range(3):
                email = f"summary-{marker}-{i}@example.com"
                emails.append(email)
                registered = client.post("/api/v1/auth/register", json={"email": email, "password": "Guvenli123", "display_name": f"Deneme {i}"})
                assert registered.status_code == 201, registered.text
                users.append(registered.json()["id"])
                token = client.post("/api/v1/auth/login", json={"email": email, "password": "Guvenli123"}).json()["access_token"]
                headers.append({"Authorization": "Bearer " + token})
                created = client.post(f"/api/v1/toilets/{facility}/reviews", headers=headers[-1], json={"cleanliness_score": 4, "comment": "Temizdi."})
                assert created.status_code == 201, created.text
                review_ids.append(created.json()["id"])
            yield dict(app=app, client=client, facility=facility, provider=provider, headers=headers,
                       users=users, reviews=review_ids, cache=cache, path=f"/api/v1/toilets/{facility}/summary")
        assert app.state.summary_service is None
    finally:
        # Facility UUID scopes Redis cleanup; never flush a shared database.
        for key in cache.scan_iter(match=f"smartloo:summary:*{facility}*"):
            cache.delete(key)
        cache.close()
        with pymongo.MongoClient(os.getenv("SMARTLOO_MONGO_URL", "mongodb://127.0.0.1:27017")) as mongo:
            mongo.drop_database(mongo_name)
        with connect() as conn:
            conn.execute("DELETE FROM review_operations WHERE toilet_id=%s", (facility,))
            conn.execute("DELETE FROM toilets WHERE id=%s AND source='summary-http-test'", (facility,))
            conn.execute("DELETE FROM users WHERE email=ANY(%s)", (emails,))
            conn.execute("DELETE FROM login_failures WHERE email=ANY(%s)", (emails,))


def test_summary_http_cache_ttl_and_private_evidence(live):
    x = live
    first = x["client"].get(x["path"])
    assert first.status_code == 200, first.text
    assert first.json()["based_on_reviews"] == 3
    assert first.json()["summary"]
    assert x["client"].get(x["path"]).json() == first.json()
    assert x["provider"].calls == 1
    keys = list(x["cache"].scan_iter(match=f'*{x["facility"]}*'))
    assert len(keys) == 1 and 21580 <= x["cache"].ttl(keys[0]) <= 21600
    assert all(set(row) == {"request_review_ref", "text"} for row in x["provider"].evidence[0])
    assert not any(uid in str(x["provider"].evidence) for uid in x["users"])


def test_summary_http_edit_invalidates_cached_revision(live):
    x = live
    before = x["client"].get(x["path"]).json()
    edited = x["client"].patch(f'/api/v1/reviews/{x["reviews"][0]}', headers=x["headers"][0], json={"comment": "Sabun yoktu."})
    assert edited.status_code == 200
    after = x["client"].get(x["path"]).json()
    assert after["summary"] != before["summary"]
    assert x["provider"].calls == 2


def test_summary_http_account_deletion_invalidates_cache_keeps_scores(live):
    x = live
    assert x["client"].get(x["path"]).json()["summary"]
    assert x["client"].delete('/api/v1/users/me', headers=x["headers"][0]).status_code == 204
    after = x["client"].get(x["path"]).json()
    assert after["based_on_reviews"] == 3
    assert x["provider"].calls == 2
    detail = x["client"].get(f'/api/v1/toilets/{x["facility"]}').json()
    assert (detail["review_count"], detail["average_cleanliness"]) == (3, 4)


@pytest.mark.parametrize("mutation", ["edit", "account_delete"])
def test_summary_http_mutation_during_generation_never_publishes_stale_text(live, mutation):
    import asyncio
    x = live
    async def mutate():
        if mutation == "edit":
            result = await asyncio.to_thread(x["client"].patch, f'/api/v1/reviews/{x["reviews"][0]}', headers=x["headers"][0], json={"comment": "Sabun yoktu."})
            assert result.status_code == 200
        else:
            result = await asyncio.to_thread(x["client"].delete, '/api/v1/users/me', headers=x["headers"][0])
            assert result.status_code == 204
    x["provider"].hook = mutate
    assert x["client"].get(x["path"]).json()["summary"] is None
    assert list(x["cache"].scan_iter(match=f'*{x["facility"]}*')) == []
    assert x["client"].get(x["path"]).json()["summary"]
    assert x["provider"].calls == 2


def test_summary_http_durable_pending_marker_blocks_cached_text_after_restart(live):
    x = live
    assert x["client"].get(x["path"]).json()["summary"]
    with PostgresReviewCoordination().guard(x["facility"]) as pending:
        pending.begin(str(uuid.uuid4()), None, author_id=x["users"][0])
    restarted = create_app(ai_provider=x["provider"], ai_profile=POLICY_VERSION, jwt_secret=KEY)
    with TestClient(restarted) as client:
        assert client.get(x["path"]).status_code == 503
        restarted.state.reviews.reconcile(x["facility"])
        assert client.get(x["path"]).json()["summary"]
    assert x["provider"].calls == 2


@pytest.mark.parametrize("mutation", ["edit", "account_delete"])
def test_summary_http_cached_mutation_still_requires_final_writer_guard(live, mutation, monkeypatch):
    import asyncio
    x = live
    assert x["client"].get(x["path"]).json()["summary"]
    cache = x["app"].state.summary_service.cache
    original_get = cache.get
    async def interrupted_read(key):
        value = await original_get(key)
        assert value is not None  # This path must really be a Redis hit.
        if mutation == "edit":
            changed = await asyncio.to_thread(x["client"].patch, f'/api/v1/reviews/{x["reviews"][0]}', headers=x["headers"][0], json={"comment": "Sabun yoktu."})
            assert changed.status_code == 200
        else:
            changed = await asyncio.to_thread(x["client"].delete, '/api/v1/users/me', headers=x["headers"][0])
            assert changed.status_code == 204
        return value
    with monkeypatch.context() as patch:
        patch.setattr(cache, "get", interrupted_read)
        assert x["client"].get(x["path"]).json()["summary"] is None
    assert x["provider"].calls == 1
    assert x["client"].get(x["path"]).json()["summary"]
    assert x["provider"].calls == 2


def test_summary_http_redis_outage_still_generates_validated_uncached_result(live, monkeypatch):
    x = live
    monkeypatch.setenv("SMARTLOO_REDIS_URL", "redis://127.0.0.1:1/15")
    with TestClient(create_app(ai_provider=x["provider"], ai_profile=POLICY_VERSION, jwt_secret=KEY)) as client:
        assert client.get(x["path"]).json()["summary"]
        assert client.get(x["path"]).json()["summary"]
    assert x["provider"].calls == 2


def test_summary_http_unconfigured_model_keeps_real_stats_and_never_calls_provider(live):
    x = live
    with TestClient(create_app(ai_profile="", jwt_secret=KEY)) as client:
        result = client.get(x["path"]).json()
    assert result["summary"] is None
    assert (result["review_count"], result["average_cleanliness"]) == (3, 4)
    assert x["provider"].calls == 0


def test_summary_http_unknown_or_personal_text_is_excluded_before_provider(live):
    x = live
    assert x["client"].patch(f'/api/v1/reviews/{x["reviews"][0]}', headers=x["headers"][0], json={"comment": "Temizdi. Özel Kişi burada."}).status_code == 200
    result = x["client"].get(x["path"]).json()
    assert result["summary"] is None
    assert result["review_count"] == 3
    assert x["provider"].calls == 0


def test_summary_http_known_author_name_matching_allowed_grammar_is_redacted(live):
    x = live
    # A common word can also be an account's known identifier. The finite
    # grammar alone cannot decide that it is safe to disclose that identifier.
    with connect() as conn:
        conn.execute("UPDATE users SET display_name='Temizdi' WHERE id=%s", (x["users"][0],))
    result = x["client"].get(x["path"]).json()
    assert result["summary"] is None
    assert result["review_count"] == 3
    assert x["provider"].calls == 0


def test_summary_http_missing_invalid_and_mongo_error_are_not_empty_success(live, monkeypatch):
    x = live
    assert x["client"].get('/api/v1/toilets/not-a-uuid/summary').status_code == 422
    assert x["client"].get(f'/api/v1/toilets/{uuid.uuid4()}/summary').status_code == 404
    def fail(*args):
        raise ReviewStoreError("synthetic Mongo read failure")
    monkeypatch.setattr(x["app"].state.reviews.reviews, "by_toilet", fail)
    assert x["client"].get(x["path"]).status_code == 503


def test_summary_http_total_deadline_cancels_slow_provider_without_publication(live):
    import asyncio
    import time
    from threading import Event
    x = live
    cancelled = Event()
    async def slow():
        try:
            await asyncio.sleep(60)
        finally:
            cancelled.set()
    x["provider"].hook = slow
    started = time.monotonic()
    response = x["client"].get(x["path"])
    assert time.monotonic() - started < 13
    assert response.status_code in (200, 503)
    if response.status_code == 200:
        assert response.json()["summary"] is None
    assert cancelled.is_set()
    assert list(x["cache"].scan_iter(match=f'*{x["facility"]}*')) == []
