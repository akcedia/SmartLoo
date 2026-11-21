"""Bounded, atomic ADMIN CSV/JSON import; no source downloads or inferred facts."""
import csv
from copy import deepcopy
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import io
import json
import re
import threading
import unicodedata
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
import psycopg
from psycopg import sql
from starlette.concurrency import run_in_threadpool

from src.auth import require_admin
from src.db import connect
from src.ibb_geojson import _no_duplicate_keys, _no_nonfinite
from src.review_coordination import review_lock_key

MAX_BYTES, MAX_ROWS = 1_000_000, 1000
IDENTITY = ("source", "source_id")
REQUIRED = (*IDENTITY, "name", "district", "latitude", "longitude")
OPTIONAL = ("address", "has_disabled_access", "has_baby_changing", "is_free", "price_try",
            "opening_hours", "status", "ibb_source_id")
FIELDS = (*REQUIRED, *OPTIONAL)
BOOLEANS = ("has_disabled_access", "has_baby_changing", "is_free")
router = APIRouter(prefix="/api/v1/admin")


def invalid(errors):
    raise HTTPException(status_code=422, detail={"errors": errors[:50], "atomic": True})


def text(value, maximum, *, nullable=False):
    if nullable and (value is None or value == ""):
        return None
    if not isinstance(value, str):
        raise ValueError("Text required")
    value = unicodedata.normalize("NFC", value.strip())
    if not value or len(value) > maximum or any(unicodedata.category(c).startswith("C") for c in value):
        raise ValueError("Invalid text length or control character")
    return value


def number(value, low, high, places):
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)) or len(str(value)) > 64:
        raise ValueError("Finite number required")
    try:
        result = Decimal(str(value))
        if not result.is_finite() or not Decimal(str(low)) <= result <= Decimal(str(high)):
            raise ValueError("Number outside allowed bounds")
        return result.quantize(Decimal(10) ** -places, rounding=ROUND_HALF_UP)
    except InvalidOperation:
        raise ValueError("Invalid number") from None


def parse_batch(raw, media_type):
    try:
        content = raw.decode("utf-8-sig")
        if media_type == "application/json":
            rows = json.loads(content, parse_float=Decimal, object_pairs_hook=_no_duplicate_keys,
                              parse_constant=_no_nonfinite)
        elif media_type == "text/csv":
            reader = csv.reader(io.StringIO(content, newline=""), strict=True)
            header = next(reader, [])
            if not header or len(set(header)) != len(header) or any(not key for key in header):
                raise ValueError("Unique nonempty CSV headers required")
            rows = []
            for values in reader:
                if len(values) != len(header):
                    raise ValueError("CSV row width differs from header")
                rows.append(dict(zip(header, values)))
                if len(rows) > MAX_ROWS:
                    raise ValueError("Batch exceeds 1000 rows")
        else:
            raise HTTPException(status_code=415, detail="Use application/json or text/csv")
    except (UnicodeError, ValueError, csv.Error, RecursionError):
        invalid([{"row": 0, "message": "Malformed UTF-8 CSV/JSON or invalid batch shape"}])
    if not isinstance(rows, list) or not 1 <= len(rows) <= MAX_ROWS:
        invalid([{"row": 0, "message": "A batch must contain 1 to 1000 facility records"}])
    clean, errors, identities, provider_ids = [], [], set(), set()
    for index, item in enumerate(rows, 1):
        row = {}
        if not isinstance(item, dict) or not set(REQUIRED) <= set(item) or set(item) - set(FIELDS):
            errors.append({"row": index, "message": "Missing required or unsupported columns"})
            continue
        for field, value in item.items():
            try:
                if field in BOOLEANS:
                    if media_type == "text/csv" and isinstance(value, str):
                        value = {"true": True, "false": False, "": None}.get(value.strip().lower(), value)
                    if value is not None and type(value) is not bool:
                        raise ValueError("Use true, false or null; CSV empty means unknown")
                elif field in ("latitude", "longitude"):
                    bound = 90 if field == "latitude" else 180
                    value = number(value, -bound, bound, 6)
                elif field == "price_try":
                    value = None if value is None or value == "" else number(value, 0, 999999.99, 2)
                elif field == "status":
                    value = None if value is None or value == "" else value
                    if value not in (None, "ACTIVE", "CLOSED", "MAINTENANCE"):
                        raise ValueError("Invalid facility status")
                else:
                    maximum = {"source": 50, "source_id": 200, "name": 150, "district": 100,
                               "address": 1000, "opening_hours": 100, "ibb_source_id": 200}[field]
                    value = text(value, maximum, nullable=field in OPTIONAL)
                    if field == "source" and not re.fullmatch(r"[a-z][a-z0-9_-]{0,49}", value):
                        raise ValueError("Use a lowercase source namespace")
                row[field] = value
            except (ValueError, TypeError):
                errors.append({"row": index, "field": field, "message": "Invalid value for this column"})
        if all(field in row for field in REQUIRED):
            key = (row["source"], row["source_id"])
            if key in identities:
                errors.append({"row": index, "message": "Duplicate source identity in batch"})
            identities.add(key)
            provider_id = row.get("ibb_source_id")
            if provider_id and provider_id in provider_ids:
                errors.append({"row": index, "message": "Duplicate provider identity in batch"})
            if provider_id:
                provider_ids.add(provider_id)
        clean.append(row)
    if errors:
        invalid(errors)
    return clean


def merged_facility(old, row, *, registered=False, index=1):
    if registered and any(row[field] != old[field] for field in ("name", "district", "latitude", "longitude")):
        invalid([{"row": index, "message": "Registered raw-source identity changes require a reviewed GeoJSON plan"}])
    if registered and "status" in row and row["status"] != old["status"]:
        invalid([{"row": index, "field": "status", "message": "Raw-source state changes require a reviewed plan or dedicated closure service"}])
    if old and old.get("ibb_source_id") and "ibb_source_id" in row and row["ibb_source_id"] != old["ibb_source_id"]:
        invalid([{"row": index, "field": "ibb_source_id", "message": "Existing provider identity must be preserved"}])
    result = {**{field: None for field in OPTIONAL}, **(old or {}), **row}
    if old:
        # Registry aliases may target a facility whose primary source_id differs.
        result.update({field: old[field] for field in IDENTITY})
    if result.get("is_free") is True and (result.get("price_try") or 0) > 0:
        invalid([{"row": index, "field": "price_try", "message": "A free facility cannot have a positive fee"}])
    return result


def busy():
    raise HTTPException(status_code=503, detail="Import busy or review recovery required; batch unchanged")


class PostgresAdminImport:
    def apply(self, rows):
        try:
            return self._apply(rows)
        except psycopg.IntegrityError as exc:
            raise HTTPException(status_code=409, detail="Source/provider identity conflict; batch unchanged") from exc
        except psycopg.Error as exc:
            raise HTTPException(status_code=503, detail="Import temporarily unavailable; batch unchanged") from exc

    def _apply(self, rows):
        counts = {"inserted": 0, "updated": 0, "unchanged": 0, "rejected": 0}
        with connect() as conn:
            conn.execute("SET LOCAL statement_timeout='5s'")
            conn.execute("SET LOCAL lock_timeout='2s'")
            # Same import mutex as reviewed raw İBB plans; shared facility lock
            # keys also serialize with reviews, closure and final AI publication.
            if not conn.execute("SELECT pg_try_advisory_xact_lock(-610061) AS ok").fetchone()["ok"]:
                busy()
            targets = []
            for row in rows:
                current = conn.execute("SELECT id::text FROM toilets WHERE source=%s AND source_id=%s",
                                       (row["source"], row["source_id"])).fetchone()
                alias = conn.execute("SELECT toilet_id::text AS id FROM external_source_identities WHERE source=%s AND fingerprint=%s",
                                     (row["source"], row["source_id"])).fetchone()
                if alias and current and alias["id"] != current["id"]:
                    raise HTTPException(status_code=409, detail="Ambiguous registered source identity; batch unchanged")
                if row["source"] == "ibb" and row["source_id"].startswith("v1:") and not alias:
                    raise HTTPException(status_code=409, detail="Raw İBB fingerprints require a reviewed GeoJSON plan")
                targets.append(((alias or current or {}).get("id", str(uuid.uuid4())), bool(alias)))
            ids = [key for key, _ in targets]
            if len(set(ids)) != len(ids):
                raise HTTPException(status_code=409, detail="Multiple batch identities target one facility")
            for key in sorted({review_lock_key(key) for key in ids}):
                if not conn.execute("SELECT pg_try_advisory_xact_lock(%s) AS ok", (key,)).fetchone()["ok"]:
                    busy()
            if conn.execute("SELECT EXISTS(SELECT 1 FROM review_operations WHERE toilet_id=ANY(%s::uuid[])) AS pending", (ids,)).fetchone()["pending"]:
                busy()
            prepared = []
            for index, (row, (key, registered)) in enumerate(zip(rows, targets), 1):
                old = conn.execute("SELECT * FROM toilets WHERE id=%s FOR UPDATE", (key,)).fetchone()
                if registered and (old is None or old["source"] != row["source"]):
                    raise HTTPException(status_code=409, detail="Registered identity cannot cross source boundaries")
                prepared.append((key, old, merged_facility(old, row, registered=registered, index=index)))
            for key, old, merged in prepared:
                if old is None:
                    conn.execute(sql.SQL("INSERT INTO toilets(id,{}) VALUES (%s,{})").format(
                        sql.SQL(',').join(map(sql.Identifier, FIELDS)), sql.SQL(',').join(sql.Placeholder() for _ in FIELDS)),
                        (key, *(merged[field] for field in FIELDS)))
                    counts["inserted"] += 1
                else:
                    counts["updated"] += 1  # matched/upserted rows, per TC-19
                    changed = any(merged.get(field) != old.get(field) for field in FIELDS)
                    if not changed:
                        counts["unchanged"] += 1
                        continue
                    columns = ("name", "district", "latitude", "longitude", *OPTIONAL)
                    conn.execute(sql.SQL("UPDATE toilets SET {}, review_version=review_version+1 WHERE id=%s").format(
                        sql.SQL(',').join(sql.SQL('{}=%s').format(sql.Identifier(field)) for field in columns)),
                        (*(merged[field] for field in columns), key))
        return counts


class RepositoryAdminImport:
    """Isolated test adapter with the same staged validation and writer guards."""
    def __init__(self, repository, coordination):
        self.repository, self.coordination = repository, coordination
        self.lock = repository.setdefault("admin_import_lock", threading.Lock())

    def apply(self, rows):
        if not self.lock.acquire(blocking=False):
            busy()
        try:
            original = self.repository.setdefault("toilets", {})
            targets = []
            for row in rows:
                key = next((key for key, old in original.items() if all(old.get(f) == row[f] for f in IDENTITY)), str(uuid.uuid4()))
                if row["source"] == "ibb" and row["source_id"].startswith("v1:"):
                    raise HTTPException(status_code=409, detail="Use the reviewed raw-source import")
                targets.append(key)
            with self.coordination.snapshot_guard(targets) as ready:
                if not ready:
                    busy()
                staged = deepcopy(original)
                counts = {"inserted": 0, "updated": 0, "unchanged": 0, "rejected": 0}
                for index, (row, key) in enumerate(zip(rows, targets), 1):
                    old = staged.get(key)
                    merged = merged_facility(old, row, index=index)
                    provider_id = merged.get("ibb_source_id")
                    if provider_id and any(k != key and r.get("ibb_source_id") == provider_id for k, r in staged.items()):
                        raise HTTPException(status_code=409, detail="Provider identity conflict; batch unchanged")
                    if old:
                        counts["updated"] += 1
                        changed = any(merged.get(field) != old.get(field) for field in FIELDS)
                        counts["unchanged"] += not changed
                        merged["review_version"] = old.get("review_version", 0) + int(changed)
                    else:
                        counts["inserted"] += 1
                        merged.update(review_count=0, average_cleanliness=None, review_version=0)
                    staged[key] = {**merged, "id": key}
                original.clear()
                original.update(staged)
                return counts
        finally:
            self.lock.release()


@router.post("/import")
async def import_facilities(request: Request, admin=Depends(require_admin)):
    parts, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_BYTES:
            raise HTTPException(status_code=413, detail="Import exceeds 1 MB")
        parts.append(chunk)
    media_type = request.headers.get("content-type", "").split(';', 1)[0].strip().lower()
    try:
        rows = parse_batch(b''.join(parts), media_type)
        return await run_in_threadpool(request.app.state.admin_import.apply, rows)
    except HTTPException as exc:
        if exc.status_code == 422 and isinstance(exc.detail, dict):
            return JSONResponse(status_code=422, content=exc.detail)
        raise
