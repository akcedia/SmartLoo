"""Regression checks for a dirty Mongo window and failed compensation."""

import pytest

from src.auth import RepositoryAccounts
from src.reviews import RepositoryReviews, RepositoryToilets, ReviewService
from test_reviews import A, U, env, post, token


def test_uncommitted_text_is_not_exposed_to_ai(env, monkeypatch):
    client, _, app = env
    service = app.state.reviews
    recompute = service.toilets.recompute
    snapshots = []

    def observe_dirty_window(*args, **kwargs):
        snapshots.append(service.read_summary_snapshot(A))
        return recompute(*args, **kwargs)

    monkeypatch.setattr(service.toilets, "recompute", observe_dirty_window)
    assert post(client, comment="Temiz").status_code == 201
    assert snapshots[0]["state"] == "busy"
    assert snapshots[0]["reviews"] == []
    assert snapshots[0]["review_count"] == snapshots[0]["review_version"] == 0
    ready = service.read_summary_snapshot(A)
    assert ready["state"] == "ready" and ready["operation_id"] is None
    assert ready["review_count"] == ready["review_version"] == 1
    assert len(ready["reviews"]) == 1


def test_failed_write_and_undo_block_reads_until_idempotent_recovery(env, monkeypatch):
    client, store, app = env
    service = app.state.reviews
    delete = service.reviews.delete

    def broken(*args, **kwargs):
        raise RuntimeError("Synthetic store failure")

    monkeypatch.setattr(service.toilets, "recompute", broken)
    monkeypatch.setattr(service.reviews, "delete", broken)
    assert post(client, comment="Uncommitted text").status_code == 503
    assert len(store["reviews"]) == 1
    assert store["review_operations"][A]["state"] == "repair_required"
    snapshot = service.read_summary_snapshot(A)
    assert snapshot["state"] == "repair_required" and snapshot["reviews"] == []
    assert snapshot["review_count"] == 0 and snapshot["average_cleanliness"] is None
    assert post(client).status_code == 503
    assert client.get(f"/api/v1/toilets/{A}/reviews").status_code == 503

    # A newly created service reads the same operation record, instead of losing
    # the repair condition when its previous coordinator object disappears.
    recovered = ReviewService(RepositoryReviews(store), RepositoryToilets(store), RepositoryAccounts(store))
    assert recovered.read_summary_snapshot(A)["state"] == "repair_required"
    monkeypatch.setattr(service.reviews, "delete", delete)
    version = recovered.reconcile(A)
    assert recovered.reconcile(A) == version
    assert store["reviews"] == {} and store["review_operations"] == {}
    assert recovered.read_summary_snapshot(A)["state"] == "ready"


@pytest.mark.parametrize("operation", ["edit", "delete"])
def test_recovery_restores_previous_document(env, monkeypatch, operation):
    client, store, app = env
    created = post(client, comment="Original text", cleanliness_score=4)
    review_id = created.json()["id"]
    before = dict(store["reviews"][review_id])
    service = app.state.reviews

    def broken(*args, **kwargs):
        raise RuntimeError("Synthetic store failure")

    with monkeypatch.context() as patch:
        patch.setattr(service.toilets, "recompute", broken)
        patch.setattr(service.reviews, "restore", broken)
        if operation == "edit":
            response = client.patch(f"/api/v1/reviews/{review_id}", headers=token(U),
                                    json={"cleanliness_score": 1, "comment": "New text"})
        else:
            response = client.delete(f"/api/v1/reviews/{review_id}", headers=token(U))
        assert response.status_code == 503
        assert service.read_summary_snapshot(A)["state"] == "repair_required"

    recovered_version = service.reconcile(A)
    assert store["reviews"][review_id] == before
    assert store["toilets"][A]["average_cleanliness"] == 4
    assert store["toilets"][A]["review_count"] == 1
    assert service.reconcile(A) == recovered_version


def test_marker_failure_prevents_any_mongo_change(env, monkeypatch):
    client, store, app = env

    def broken(*args, **kwargs):
        raise RuntimeError("Marker persistence failed")

    from src.review_coordination import MemoryReviewSession
    monkeypatch.setattr(MemoryReviewSession, "begin", broken)
    with pytest.raises(RuntimeError, match="Marker persistence failed"):
        post(client)
    assert store["reviews"] == {}
