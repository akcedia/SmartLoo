"""FR-10 account deletion on the isolated in-memory stores (#56). No database needed.

Real PostgreSQL + MongoDB behaviour is in test_account_deletion_integration.py.
"""
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import jwt
import pytest
from fastapi.testclient import TestClient

from src.app import create_app
from src.auth import Principal
from src.reviews import ReviewIn
from fastapi import HTTPException

KEY = "requirements-test-only-signing-key-at-least-32-bytes"
A, B = "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"
U, V = "00000000-0000-4000-9000-000000000001", "00000000-0000-4000-9000-000000000002"


def token(user, role="USER"):
    now = int(time.time())
    return {"Authorization": "Bearer " + jwt.encode(
        {"sub": user, "role": role, "iat": now, "exp": now + 3600}, KEY, algorithm="HS256")}


@pytest.fixture
def env():
    state = {
        "toilets": {t: {"id": t, "status": "ACTIVE", "average_cleanliness": None, "review_count": 0}
                    for t in (A, B)},
        "users": {U: {"id": U, "email": "ayse.k@example.com", "display_name": "Ayşe K", "role": "USER",
                      "password_hash": "x"},
                  V: {"id": V, "email": "veli@example.com", "display_name": "Veli", "role": "USER",
                      "password_hash": "x"}},
        "reviews": {}, "login_attempts": [{"email": "ayse.k@example.com", "at": time.time()}]}
    app = create_app(state, jwt_secret=KEY)
    with TestClient(app) as client:
        for toilet, score, comment in [(A, 4, "Temiz. Ayşe K yazdı, ayse.k@example.com"),
                                       (B, 2, "Sabun yok, beni 0532 123 45 67 ara")]:
            assert client.post(f"/api/v1/toilets/{toilet}/reviews", headers=token(U),
                               json={"cleanliness_score": score, "comment": comment}).status_code == 201
        assert client.post(f"/api/v1/toilets/{A}/reviews", headers=token(V),
                           json={"cleanliness_score": 2, "comment": "Veli'nin yorumu"}).status_code == 201
        yield client, app.state.repository, app


def test_delete_removes_account_and_keeps_anonymized_reviews(env):
    client, store, _ = env
    before = {t: dict(store["toilets"][t]) for t in (A, B)}
    assert client.delete("/api/v1/users/me", headers=token(U)).status_code == 204

    assert U not in store["users"] and store["login_attempts"] == []
    own = [r for r in store["reviews"].values() if r["is_anonymized"]]
    assert len(store["reviews"]) == 3 and sorted(r["toilet_id"] for r in own) == [A, B]
    for review in own:
        assert review["user_id"] is None and review["is_anonymized"] is True
        assert "ayse" not in review["comment"].lower() and "0532" not in review["comment"]
        assert "[removed]" in review["comment"]
    for toilet in (A, B):  # scores kept: aggregates unchanged, revision moved for stale summaries
        after = store["toilets"][toilet]
        assert (after["average_cleanliness"], after["review_count"]) == \
               (before[toilet]["average_cleanliness"], before[toilet]["review_count"])
        assert after["review_version"] == before[toilet]["review_version"] + 1


def test_other_users_reviews_are_untouched(env):
    client, store, _ = env
    client.delete("/api/v1/users/me", headers=token(U))
    veli = [r for r in store["reviews"].values() if r["user_id"] == V]
    assert len(veli) == 1 and veli[0]["comment"] == "Veli'nin yorumu"
    listing = client.get(f"/api/v1/toilets/{A}/reviews", headers=token(V)).json()["results"]
    assert sorted((r["author"], r["is_own"], r["can_edit"]) for r in listing) == \
           [("Anonymous", False, False), ("Veli", True, True)]


def test_old_token_stops_working_and_guest_gets_401(env):
    client, _, _ = env
    assert client.delete("/api/v1/users/me").status_code == 401
    assert client.delete("/api/v1/users/me", headers=token(U)).status_code == 204
    assert client.delete("/api/v1/users/me", headers=token(U)).status_code == 401
    assert client.post(f"/api/v1/toilets/{B}/reviews", headers=token(U),
                       json={"cleanliness_score": 5}).status_code == 401


def test_failure_keeps_the_account_so_a_retry_finishes(env, monkeypatch):
    client, store, app = env
    toilets = app.state.reviews.toilets
    original = toilets.recompute
    calls = {"n": 0}

    def fail_second(*args, **kwargs):  # first facility succeeds, second fails
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("PostgreSQL write failed")
        return original(*args, **kwargs)

    monkeypatch.setattr(toilets, "recompute", fail_second)
    assert client.delete("/api/v1/users/me", headers=token(U)).status_code == 503
    assert U in store["users"]
    assert sum(r["user_id"] == U for r in store["reviews"].values()) == 1  # one done, one rolled back

    monkeypatch.setattr(toilets, "recompute", original)
    assert client.delete("/api/v1/users/me", headers=token(U)).status_code == 204
    assert U not in store["users"]
    assert not any(r["user_id"] == U for r in store["reviews"].values())
    assert not store.get("review_operations")


def test_prevalidated_create_cannot_reintroduce_data_after_deletion(env, monkeypatch):
    client, store, app = env
    reached, proceed, attempted = Event(), Event(), Event()
    original = app.state.accounts.delete
    def pause(*args):
        reached.set()
        assert proceed.wait(10)
        return original(*args)
    monkeypatch.setattr(app.state.accounts, "delete", pause)
    # A request already has a valid Principal before the deletion completes.
    def stale_write():
        attempted.set()
        return app.state.reviews.create(Principal(U, "USER"), B, ReviewIn(cleanliness_score=5, comment="private"))
    with ThreadPoolExecutor(max_workers=2) as pool:
        deletion = pool.submit(client.delete, "/api/v1/users/me", headers=token(U))
        try:
            assert reached.wait(10)
            write = pool.submit(stale_write)
            assert attempted.wait(10)
        finally:
            proceed.set()
        assert deletion.result(timeout=10).status_code == 204
        with pytest.raises(HTTPException) as rejected:
            write.result(timeout=10)
        assert rejected.value.status_code == 401
    assert U not in store["users"]
    assert not any(r.get("user_id") == U for r in store["reviews"].values())


def test_pending_create_marker_blocks_account_removal_even_without_mongo_document(env):
    client, store, app = env
    with app.state.reviews.coordination.guard(A) as session:
        session.begin("interrupted-create", None, author_id=U)
    assert client.delete("/api/v1/users/me", headers=token(U)).status_code == 503
    assert U in store["users"]


def test_failed_undo_is_recovered_before_account_can_be_removed(env, monkeypatch):
    client, store, app = env
    service = app.state.reviews
    recompute, restore = service.toilets.recompute, service.reviews.restore
    monkeypatch.setattr(service.toilets, "recompute", lambda *a, **kw: (_ for _ in ()).throw(RuntimeError("SQL fail")))
    monkeypatch.setattr(service.reviews, "restore", lambda *a: (_ for _ in ()).throw(RuntimeError("undo fail")))
    assert client.delete("/api/v1/users/me", headers=token(U)).status_code == 503
    assert service.coordination.pending_for_author(U)
    # Mongo author link is already null, so by_user alone cannot detect this.
    assert any(r.get("is_anonymized") for r in store["reviews"].values())
    assert client.delete("/api/v1/users/me", headers=token(U)).status_code == 503
    assert U in store["users"]
    monkeypatch.setattr(service.toilets, "recompute", recompute)
    monkeypatch.setattr(service.reviews, "restore", restore)
    for key in list(store["review_operations"]):
        service.reconcile(key)
    assert client.delete("/api/v1/users/me", headers=token(U)).status_code == 204


def test_admin_moderation_uses_the_target_authors_account_guard(env):
    _, state, app = env
    state["users"][V]["role"] = "ADMIN"
    doc = app.state.reviews.reviews.by_user(U)[0]
    # Holding the author lock must prevent a different principal's moderation.
    with app.state.accounts.guard([U]):
        with ThreadPoolExecutor(max_workers=1) as pool:
            attempt = pool.submit(app.state.reviews.delete, Principal(V, "ADMIN"), doc["id"])
            with pytest.raises(HTTPException) as busy:
                attempt.result(timeout=5)
            assert busy.value.status_code == 503
