"""Review service for FR-03: list, create, edit and delete reviews with consistent toilet aggregates.

Reviews live in MongoDB; average_cleanliness, review_count and review_version live on the
PostgreSQL toilet row. Every change follows the same order:
  1. write MongoDB;
  2. in one PostgreSQL transaction: lock the toilet row, recompute mean and count from
     MongoDB, increment review_version;
  3. only then answer success.
If step 2 fails, step 1 is undone and the request gets 503. Aggregates are recomputed rather
than incremented, so repeating step 2 (reconcile) is always safe after an interrupted request.

Contract: docs/contracts/reviews-service.md. Tests inject RepositoryReviews and
RepositoryToilets over the in-memory state; the API uses MongoReviews and PostgresToilets.
"""

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, StrictInt, field_validator, model_validator

from src.auth import Principal, bearer, current_user
from src.db import connect
from src.review_scores import ReviewStoreError, ensure_review_indexes, review_collection

# Proposed predefined labels (FR-03 names well-lit and no-soap as examples).
ALLOWED_TAGS = ("clean", "dirty", "smelly", "well-lit", "no-soap", "no-paper", "no-water", "out-of-order")
DUPLICATE_MESSAGE = "You have already reviewed this toilet. Edit your existing review."
INCONSISTENT_MESSAGE = "The review could not be saved consistently. Please try again."
PII_PATTERN = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\+?\d[\d\s().-]{7,}\d")


class DuplicateReview(Exception):
    pass


def valid_tags(tags):
    unknown = sorted(set(tags) - set(ALLOWED_TAGS))
    if unknown:
        raise ValueError(f"Unknown tags {unknown}; allowed: {list(ALLOWED_TAGS)}")
    return list(dict.fromkeys(tags))


class ReviewIn(BaseModel):
    cleanliness_score: StrictInt = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)
    tags: list[str] = Field(default_factory=list)

    @field_validator("tags")
    @classmethod
    def known_tags(cls, value):
        return valid_tags(value)


class ReviewPatch(BaseModel):
    cleanliness_score: StrictInt | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)
    tags: list[str] | None = None

    @field_validator("tags")
    @classmethod
    def known_tags(cls, value):
        return None if value is None else valid_tags(value)

    @model_validator(mode="after")
    def something_to_change(self):
        if not self.model_fields_set:
            raise ValueError("Send at least one of cleanliness_score, comment, tags")
        if "cleanliness_score" in self.model_fields_set and self.cleanliness_score is None:
            raise ValueError("cleanliness_score cannot be removed")
        return self


def as_uuid(value):
    try:
        return str(uuid.UUID(str(value)))
    except ValueError:
        return None


class RepositoryReviews:
    """Isolated review store over the in-memory test state; not a production database."""

    def __init__(self, repository):
        self.repository = repository
        repository.setdefault("reviews", {})

    @property
    def docs(self):  # looked up each time: tests may replace the whole dict
        return self.repository["reviews"]

    def get(self, review_id):
        doc = self.docs.get(review_id)
        return dict(doc) if doc else None

    def by_toilet(self, toilet_id):
        docs = [dict(d) for d in self.docs.values() if d["toilet_id"] == toilet_id]
        return sorted(docs, key=lambda d: str(d.get("created_at")), reverse=True)

    def find_user_review(self, toilet_id, user_id):
        return next((dict(d) for d in self.docs.values()
                     if d["toilet_id"] == toilet_id and d.get("user_id") == user_id), None)

    def insert(self, doc):
        if self.find_user_review(doc["toilet_id"], doc["user_id"]):
            raise DuplicateReview
        self.docs[doc["id"]] = {k: v.isoformat() if isinstance(v, datetime) else v for k, v in doc.items()}

    def replace(self, doc):
        self.docs[doc["id"]] = {k: v.isoformat() if isinstance(v, datetime) else v for k, v in doc.items()}

    def delete(self, review_id):
        self.docs.pop(review_id, None)

    def scores(self, toilet_id):
        return [d["cleanliness_score"] for d in self.docs.values() if d["toilet_id"] == toilet_id]


class MongoReviews:
    """The MongoDB `reviews` collection; connects and creates its indexes on first use."""

    def __init__(self, collection_factory=review_collection):
        self._factory = collection_factory
        self._collection = None

    def _call(self, operation):
        from pymongo.errors import DuplicateKeyError, PyMongoError

        try:
            if self._collection is None:
                collection = self._factory()
                ensure_review_indexes(collection)
                self._collection = collection
            return operation(self._collection)
        except DuplicateKeyError as exc:
            raise DuplicateReview from exc
        except PyMongoError as exc:
            raise ReviewStoreError("Review store unavailable") from exc

    def get(self, review_id):
        return self._call(lambda c: c.find_one({"id": review_id}, {"_id": 0}))

    def by_toilet(self, toilet_id):
        return self._call(lambda c: list(c.find({"toilet_id": toilet_id}, {"_id": 0}).sort("created_at", -1)))

    def find_user_review(self, toilet_id, user_id):
        return self._call(lambda c: c.find_one({"toilet_id": toilet_id, "user_id": user_id}, {"_id": 0}))

    def insert(self, doc):
        self._call(lambda c: c.insert_one(dict(doc)))

    def replace(self, doc):
        self._call(lambda c: c.replace_one({"id": doc["id"]}, dict(doc)))

    def delete(self, review_id):
        self._call(lambda c: c.delete_one({"id": review_id}))

    def scores(self, toilet_id):
        return self._call(lambda c: [d["cleanliness_score"] for d in
                                     c.find({"toilet_id": toilet_id}, {"_id": 0, "cleanliness_score": 1})])


def aggregates(scores):
    return (round(sum(scores) / len(scores), 2) if scores else None), len(scores)


class RepositoryToilets:
    """Isolated toilet aggregates over the in-memory test state."""

    def __init__(self, repository):
        self.repository = repository
        repository.setdefault("toilets", {})

    @property
    def toilets(self):
        return self.repository["toilets"]

    def get(self, toilet_id):
        toilet = self.toilets.get(toilet_id)
        return {"id": toilet_id, "status": toilet.get("status", "ACTIVE")} if toilet else None

    def recompute(self, toilet_id, scores_of):
        toilet = self.toilets[toilet_id]
        average, count = aggregates(scores_of(toilet_id))
        version = toilet.get("review_version", 0) + 1
        toilet.update(average_cleanliness=average, review_count=count, review_version=version)
        return version

    def version(self, toilet_id):
        return self.toilets[toilet_id].get("review_version", 0)


class PostgresToilets:
    def get(self, toilet_id):
        with connect() as conn:
            return conn.execute("SELECT id::text AS id, status::text AS status FROM toilets WHERE id = %s",
                                (toilet_id,)).fetchone()

    def recompute(self, toilet_id, scores_of):
        # The row lock makes concurrent changes to one toilet recompute one after another; each
        # reads MongoDB after its own write, so the last commit always sees every finished write.
        with connect() as conn:
            conn.execute("SELECT 1 FROM toilets WHERE id = %s FOR UPDATE", (toilet_id,))
            average, count = aggregates(scores_of(toilet_id))
            return conn.execute(
                """UPDATE toilets
                   SET average_cleanliness = %s, review_count = %s, review_version = review_version + 1
                   WHERE id = %s RETURNING review_version""",
                (average, count, toilet_id),
            ).fetchone()["review_version"]

    def version(self, toilet_id):
        with connect() as conn:
            return conn.execute("SELECT review_version FROM toilets WHERE id = %s",
                                (toilet_id,)).fetchone()["review_version"]


def redact(text):
    return PII_PATTERN.sub("[removed]", text) if text else text


class ReviewService:
    def __init__(self, reviews, toilets, accounts):
        self.reviews, self.toilets, self.accounts = reviews, toilets, accounts

    def _toilet(self, toilet_id, for_review=False):
        key = as_uuid(toilet_id)
        toilet = self.toilets.get(key) if key else None
        if toilet is None or (for_review and toilet["status"] == "CLOSED"):
            raise HTTPException(status_code=404, detail="Toilet not found")
        return key

    def _review(self, review_id):
        doc = self.reviews.get(review_id)
        if doc is None:
            raise HTTPException(status_code=404, detail="Review not found")
        return doc

    def _public(self, doc, principal=None):
        author = self.accounts.get(doc["user_id"]) if doc.get("user_id") else None
        is_own = principal is not None and doc.get("user_id") == principal.sub
        return {
            "id": doc["id"],
            "toilet_id": doc["toilet_id"],
            "author": author["display_name"] if author else "Anonymous",
            "cleanliness_score": doc["cleanliness_score"],
            "comment": doc.get("comment"),
            "tags": doc.get("tags") or [],
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
            "is_own": is_own,
            "can_edit": is_own,
            "can_delete": is_own or (principal is not None and principal.role == "ADMIN"),
        }

    def _commit(self, toilet_id, undo):
        """Recompute aggregates and bump the revision; on failure undo the MongoDB change."""
        try:
            return self.toilets.recompute(toilet_id, self.reviews.scores)
        except Exception as exc:
            try:
                undo()
            except Exception:
                pass  # MongoDB keeps the change; reconcile() brings the aggregates back in line
            raise HTTPException(status_code=503, detail=INCONSISTENT_MESSAGE) from exc

    def list(self, toilet_id, limit=20, offset=0, principal=None):
        key = self._toilet(toilet_id)
        docs = self.reviews.by_toilet(key)
        return {"count": len(docs), "results": [self._public(d, principal) for d in docs[offset:offset + limit]]}

    def create(self, principal, toilet_id, payload):
        key = self._toilet(toilet_id, for_review=True)
        if self.reviews.find_user_review(key, principal.sub):
            raise HTTPException(status_code=409, detail=DUPLICATE_MESSAGE)
        now = datetime.now(timezone.utc)
        doc = {"id": str(uuid.uuid4()), "toilet_id": key, "user_id": principal.sub,
               "cleanliness_score": payload.cleanliness_score, "comment": payload.comment,
               "tags": payload.tags, "is_anonymized": False, "created_at": now, "updated_at": now}
        try:
            self.reviews.insert(doc)
        except DuplicateReview as exc:  # a concurrent request won the unique index
            raise HTTPException(status_code=409, detail=DUPLICATE_MESSAGE) from exc
        self._commit(key, undo=lambda: self.reviews.delete(doc["id"]))
        return self._public(self.reviews.get(doc["id"]), principal)

    def update(self, principal, review_id, patch):
        old = self._review(review_id)
        if old.get("user_id") != principal.sub:  # ADMIN may delete, not edit, another user's review
            raise HTTPException(status_code=403, detail="Only the author can edit this review")
        new = {**old, **{field: getattr(patch, field) for field in patch.model_fields_set},
               "updated_at": datetime.now(timezone.utc)}
        self.reviews.replace(new)
        self._commit(old["toilet_id"], undo=lambda: self.reviews.replace(old))
        return self._public(self.reviews.get(review_id), principal)

    def delete(self, principal, review_id):
        old = self._review(review_id)
        if old.get("user_id") != principal.sub and principal.role != "ADMIN":
            raise HTTPException(status_code=403, detail="Only the author or an administrator can delete this review")
        self.reviews.delete(review_id)
        self._commit(old["toilet_id"], undo=lambda: self.reviews.insert(old))

    def eligible_for_summary(self, toilet_id, limit=50):
        """For the AI summary (Emir): newest commented reviews, PII redacted, no user identity."""
        key = self._toilet(toilet_id)
        docs = [d for d in self.reviews.by_toilet(key) if (d.get("comment") or "").strip()][:limit]
        return {
            "review_version": self.toilets.version(key),
            "reviews": [{"id": d["id"], "cleanliness_score": d["cleanliness_score"],
                         "comment": redact(d["comment"]), "created_at": d.get("created_at")} for d in docs],
        }

    def reconcile(self, toilet_id):
        """Recompute one toilet's aggregates from MongoDB, e.g. after an interrupted request."""
        return self.toilets.recompute(self._toilet(toilet_id), self.reviews.scores)


router = APIRouter(prefix="/api/v1")


def optional_user(request: Request,
                  credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if credentials is None:
        return None
    return current_user(request, credentials)


@router.get("/toilets/{toilet_id}/reviews")
def list_reviews(toilet_id: str, request: Request,
                 limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
                 principal: Principal | None = Depends(optional_user)):
    return request.app.state.reviews.list(toilet_id, limit, offset, principal)


@router.post("/toilets/{toilet_id}/reviews", status_code=201)
def create_review(toilet_id: str, payload: ReviewIn, request: Request,
                  principal: Principal = Depends(current_user)):
    return request.app.state.reviews.create(principal, toilet_id, payload)


@router.patch("/reviews/{review_id}")
def update_review(review_id: str, patch: ReviewPatch, request: Request,
                  principal: Principal = Depends(current_user)):
    return request.app.state.reviews.update(principal, review_id, patch)


@router.delete("/reviews/{review_id}", status_code=204)
def delete_review(review_id: str, request: Request, principal: Principal = Depends(current_user)):
    request.app.state.reviews.delete(principal, review_id)
    return Response(status_code=204)
