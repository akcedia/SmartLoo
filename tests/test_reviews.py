"""FR-03 review service on the isolated in-memory stores (#56). No database needed.

Covers validation, ownership, aggregates, review_version, compensation on a failed
aggregate update and the AI input interface. Real-store behaviour is in
test_reviews_integration.py.
"""
import time

import jwt
import pytest
from fastapi.testclient import TestClient

from src.app import create_app

KEY = "requirements-test-only-signing-key-at-least-32-bytes"
A = "00000000-0000-4000-8000-000000000001"
CLOSED = "00000000-0000-4000-8000-000000000003"
U, V, ADMIN = [f"00000000-0000-4000-9000-{n:012}" for n in range(1, 4)]


def token(user, role="USER"):
    now = int(time.time())
    return {"Authorization": "Bearer " + jwt.encode(
        {"sub": user, "role": role, "iat": now, "exp": now + 3600}, KEY, algorithm="HS256")}


@pytest.fixture
def env():
    state = {
        "toilets": {A: {"id": A, "status": "ACTIVE", "average_cleanliness": None, "review_count": 0},
                    CLOSED: {"id": CLOSED, "status": "CLOSED", "average_cleanliness": None, "review_count": 0}},
        "users": {u: {"id": u, "email": f"{n}@example.com", "display_name": n, "role": r, "password_hash": "x"}
                  for u, n, r in [(U, "Ali", "USER"), (V, "Veli", "USER"), (ADMIN, "Admin", "ADMIN")]},
        "reviews": {}, "login_attempts": []}
    app = create_app(state, jwt_secret=KEY)
    with TestClient(app) as client:
        yield client, app.state.repository, app


def post(client, user=U, toilet=A, **body):
    return client.post(f"/api/v1/toilets/{toilet}/reviews", headers=token(user),
                       json={"cleanliness_score": 4, **body})


@pytest.mark.parametrize("body, field", [
    ({"cleanliness_score": 0}, "cleanliness_score"),
    ({"cleanliness_score": 6}, "cleanliness_score"),
    ({"cleanliness_score": 3.5}, "cleanliness_score"),
    ({"comment": "x" * 1001}, "comment"),
    ({"tags": ["sparkly"]}, "tags"),
])
def test_invalid_review_is_rejected_and_not_saved(env, body, field):
    client, store, _ = env
    response = post(client, **body)
    assert response.status_code == 422 and field in response.text
    assert store["reviews"] == {} and store["toilets"][A]["review_count"] == 0


def test_guest_missing_and_closed_toilet(env):
    client, store, _ = env
    assert client.post(f"/api/v1/toilets/{A}/reviews", json={"cleanliness_score": 4}).status_code == 401
    assert post(client, toilet="00000000-0000-4000-8000-999999999999").status_code == 404
    assert post(client, toilet="not-a-uuid").status_code == 404
    assert post(client, toilet=CLOSED).status_code == 404
    assert store["reviews"] == {}


def test_create_updates_aggregates_and_revision(env):
    client, store, _ = env
    created = post(client, comment="Temiz", tags=["clean", "well-lit", "clean"])
    assert created.status_code == 201, created.text
    assert created.json()["tags"] == ["clean", "well-lit"] and created.json()["author"] == "Ali"
    post(client, user=V, cleanliness_score=2)
    toilet = store["toilets"][A]
    assert (toilet["average_cleanliness"], toilet["review_count"], toilet["review_version"]) == (3, 2, 2)


def test_second_review_by_same_user_is_409(env):
    client, store, _ = env
    post(client)
    response = post(client, cleanliness_score=1)
    assert response.status_code == 409
    assert response.json()["detail"] == "You have already reviewed this toilet. Edit your existing review."
    assert store["toilets"][A]["review_count"] == 1


def test_only_the_author_edits(env):
    client, store, _ = env
    review_id = post(client).json()["id"]
    for other, role in [(V, "USER"), (ADMIN, "ADMIN")]:
        response = client.patch(f"/api/v1/reviews/{review_id}", headers=token(other, role), json={"cleanliness_score": 1})
        assert response.status_code == 403
    edited = client.patch(f"/api/v1/reviews/{review_id}", headers=token(U), json={"cleanliness_score": 2, "comment": None})
    assert edited.status_code == 200 and edited.json()["comment"] is None
    assert store["toilets"][A]["average_cleanliness"] == 2 and store["toilets"][A]["review_version"] == 2
    assert client.patch(f"/api/v1/reviews/{review_id}", headers=token(U), json={}).status_code == 422


def test_delete_by_author_or_admin_only(env):
    client, store, _ = env
    mine = post(client).json()["id"]
    theirs = post(client, user=V, cleanliness_score=2).json()["id"]
    assert client.delete(f"/api/v1/reviews/{theirs}", headers=token(U)).status_code == 403
    assert client.delete(f"/api/v1/reviews/{mine}", headers=token(U)).status_code == 204
    assert client.delete(f"/api/v1/reviews/{theirs}", headers=token(ADMIN, "ADMIN")).status_code == 204
    assert client.delete(f"/api/v1/reviews/{theirs}", headers=token(ADMIN, "ADMIN")).status_code == 404
    toilet = store["toilets"][A]
    assert (toilet["average_cleanliness"], toilet["review_count"], toilet["review_version"]) == (None, 0, 4)


def test_public_list_shows_anonymous_author(env):
    client, store, _ = env
    post(client, comment="Temiz")
    post(client, user=V, cleanliness_score=2)
    del store["users"][V]  # account deleted: the review stays, attributed to Anonymous
    listing = client.get(f"/api/v1/toilets/{A}/reviews")
    assert listing.status_code == 200
    assert listing.json()["count"] == 2
    assert sorted(r["author"] for r in listing.json()["results"]) == ["Ali", "Anonymous"]
    assert client.get("/api/v1/toilets/00000000-0000-4000-8000-999999999999/reviews").status_code == 404


def test_failed_aggregate_update_undoes_the_review(env, monkeypatch):
    client, store, app = env
    kept = post(client, user=V, cleanliness_score=2).json()["id"]

    def broken(*args, **kwargs):
        raise RuntimeError("PostgreSQL write failed")

    monkeypatch.setattr(app.state.reviews.toilets, "recompute", broken)
    assert post(client, cleanliness_score=5).status_code == 503
    assert client.patch(f"/api/v1/reviews/{kept}", headers=token(V), json={"cleanliness_score": 5}).status_code == 503
    assert client.delete(f"/api/v1/reviews/{kept}", headers=token(V)).status_code == 503
    assert [(r["user_id"], r["cleanliness_score"]) for r in store["reviews"].values()] == [(V, 2)]
    assert store["toilets"][A]["review_count"] == 1


def test_summary_input_is_redacted_and_versioned(env):
    client, store, app = env
    post(client, comment="Temiz ama ali@example.com veya 0532 123 45 67 yazmışlar")
    post(client, user=V, cleanliness_score=2)  # no comment: not useful for a summary
    data = app.state.reviews.eligible_for_summary(A)
    assert data["review_version"] == 2
    assert len(data["reviews"]) == 1
    review = data["reviews"][0]
    assert set(review) == {"id", "cleanliness_score", "comment", "created_at"}
    assert "@" not in review["comment"] and "0532" not in review["comment"]
