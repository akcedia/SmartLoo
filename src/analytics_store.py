"""Analytics adapters; production uses the shared SQL and #50 score reader."""
from datetime import datetime, timezone

from src.admin_analytics import read_analytics_facilities
from src.db import connect
from src.review_scores import read_review_scores, review_collection


def read_facilities(district):
    return read_analytics_facilities(connect, district)


def read_scores(ids, start, end):
    collection = review_collection()
    try:
        return read_review_scores(collection, ids, start, end)
    finally:
        collection.database.client.close()


def repository_facilities(repository, district):
    rows = [dict(row) for row in repository.get("toilets", {}).values()
            if district is None or row["district"] == district]
    return sorted(rows, key=lambda row: (row["district"], row["name"], str(row["id"])))


def repository_scores(repository, ids, start, end):
    selected = set(ids)
    result = []
    for review in repository.get("reviews", {}).values():
        if str(review["toilet_id"]) not in selected:
            continue
        created = review["created_at"]
        if isinstance(created, str):
            created = datetime.fromisoformat(created)
        created = created.replace(tzinfo=created.tzinfo or timezone.utc)
        if start <= created < end:
            result.append({"toilet_id": str(review["toilet_id"]), "created_at": created,
                           "cleanliness_score": review["cleanliness_score"]})
    return result
