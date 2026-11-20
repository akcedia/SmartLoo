"""Shared facility guard and durable review-operation lifecycle."""

import json
import threading
import time
import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from copy import deepcopy
from datetime import datetime

from psycopg.types.json import Jsonb

from src.db import connect


def document_json(document):
    if document is None:
        return None
    return json.loads(json.dumps(document, default=lambda value: value.isoformat()))


class MemoryReviewCoordination:
    """Test coordination scoped to one injected in-memory repository."""

    def __init__(self, repository):
        self.repository = repository
        self.pending_operations = repository.setdefault("review_operations", {})
        self.locks = repository.setdefault("review_locks", {})
        self.current = ContextVar(f"review-session-{id(self)}", default=None)

    @contextmanager
    def guard(self, toilet_id, wait=True):
        lock = self.locks.setdefault(toilet_id, threading.Lock())
        acquired = lock.acquire(timeout=2 if wait else 0)
        if not acquired:
            yield None
            return
        session = MemoryReviewSession(self, toilet_id)
        token = self.current.set(session)
        try:
            yield session
        finally:
            self.current.reset(token)
            lock.release()

    def metadata(self, toilet_id):
        row = self.repository["toilets"][toilet_id]
        return {
            "review_version": row.get("review_version", 0),
            "review_count": row.get("review_count", 0),
            "average_cleanliness": row.get("average_cleanliness"),
            "operation": deepcopy(self.pending_operations.get(toilet_id)),
        }


class MemoryReviewSession:
    connection = None

    def __init__(self, coordination, toilet_id):
        self.coordination = coordination
        self.toilet_id = toilet_id

    def pending(self):
        return deepcopy(self.coordination.pending_operations.get(self.toilet_id))

    def begin(self, review_id, before):
        if self.pending() is not None:
            raise RuntimeError("Review repair required")
        operation = {
            "operation_id": str(uuid.uuid4()), "review_id": review_id,
            "before_document": document_json(before), "state": "writing",
        }
        self.coordination.pending_operations[self.toilet_id] = operation
        return operation

    def clear(self, operation_id):
        pending = self.pending()
        if pending is None or pending["operation_id"] != operation_id:
            raise RuntimeError("Review operation changed")
        del self.coordination.pending_operations[self.toilet_id]

    def repair_required(self):
        self.coordination.pending_operations[self.toilet_id]["state"] = "repair_required"

    def finish(self, operation_id, recompute):
        toilet = self.coordination.repository["toilets"][self.toilet_id]
        before = deepcopy(toilet)
        try:
            version = recompute()
            self.clear(operation_id)
        except BaseException:
            toilet.clear()
            toilet.update(before)
            raise
        return version


class PostgresReviewCoordination:
    def __init__(self):
        self.current = ContextVar(f"review-session-{id(self)}", default=None)

    @contextmanager
    def guard(self, toilet_id, wait=True):
        # Dedicated session owns the advisory lock across marker and aggregate commits.
        with connect() as connection:
            connection.autocommit = True
            connection.execute("SET statement_timeout = '5s'")
            key = uuid.UUID(toilet_id).int % (2 ** 63)
            deadline = time.monotonic() + (2 if wait else 0)
            while True:
                acquired = connection.execute(
                    "SELECT pg_try_advisory_lock(%s) AS acquired", (key,),
                ).fetchone()["acquired"]
                if acquired or time.monotonic() >= deadline:
                    break
                time.sleep(0.02)
            if not acquired:
                yield None
                return
            session = PostgresReviewSession(connection, toilet_id)
            token = self.current.set(session)
            try:
                yield session
            finally:
                self.current.reset(token)
                # Closing this dedicated connection releases its session lock even after errors.
                connection.close()

    def metadata(self, toilet_id):
        with connect() as connection:
            row = connection.execute(
                """SELECT t.review_version, t.review_count, t.average_cleanliness,
                          o.operation_id::text, o.review_id, o.before_document, o.state
                   FROM toilets t LEFT JOIN review_operations o ON o.toilet_id = t.id
                   WHERE t.id = %s""", (toilet_id,),
            ).fetchone()
        if row is None:
            raise LookupError("Toilet not found")
        return {
            "review_version": row["review_version"], "review_count": row["review_count"],
            "average_cleanliness": float(row["average_cleanliness"]) if row["average_cleanliness"] is not None else None,
            "operation": {key: row[key] for key in ("operation_id", "review_id", "before_document", "state")}
            if row["operation_id"] else None,
        }


class PostgresReviewSession:
    def __init__(self, connection, toilet_id):
        self.connection = connection
        self.toilet_id = toilet_id

    def pending(self):
        return self.connection.execute(
            """SELECT operation_id::text, review_id, before_document, state
               FROM review_operations WHERE toilet_id = %s""", (self.toilet_id,),
        ).fetchone()

    def begin(self, review_id, before):
        operation_id = str(uuid.uuid4())
        self.connection.execute(
            """INSERT INTO review_operations (toilet_id, operation_id, review_id, before_document)
               VALUES (%s, %s, %s, %s)""",
            (self.toilet_id, operation_id, review_id, Jsonb(document_json(before))),
        )
        return self.pending()

    def clear(self, operation_id):
        result = self.connection.execute(
            "DELETE FROM review_operations WHERE toilet_id = %s AND operation_id = %s",
            (self.toilet_id, operation_id),
        )
        if result.rowcount != 1:
            raise RuntimeError("Review operation changed")

    def repair_required(self):
        self.connection.execute(
            "UPDATE review_operations SET state = 'repair_required' WHERE toilet_id = %s",
            (self.toilet_id,),
        )

    def finish(self, operation_id, recompute):
        with self.connection.transaction():
            version = recompute()
            self.clear(operation_id)
        return version


def restored_document(document):
    restored = deepcopy(document)
    for field in ("created_at", "updated_at"):
        if isinstance(restored.get(field), str):
            restored[field] = datetime.fromisoformat(restored[field])
    return restored
