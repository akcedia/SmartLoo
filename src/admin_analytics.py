"""Admin summary and export over the same date-filtered review selection."""

import csv
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from io import StringIO
from typing import Literal
from urllib.parse import quote
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Response


ISTANBUL = ZoneInfo("Europe/Istanbul")
ONE_DAY = timedelta(days=1)
CRITICAL_THRESHOLD = 3.5
DATE_PATTERN = r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
EXPORT_COLUMNS = (
    "facility_id", "district", "hygiene_score", "open_issues_count", "last_cleaned_at",
)


class AnalyticsUnavailable(Exception):
    """A facility or review store failed to serve the requested selection."""


@dataclass(frozen=True)
class AnalyticsFilters:
    district: str | None
    start: date
    end: date
    start_utc: datetime
    end_utc: datetime

    def as_dict(self):
        return {
            "district": self.district, "from": self.start.isoformat(),
            "to": self.end.isoformat(), "timezone": ISTANBUL.key,
        }


def _invalid_date(field, value, message):
    return HTTPException(status_code=422, detail=[{
        "type": "value_error", "loc": ["query", field], "msg": message, "input": value,
    }])


def _parse_date(field, value):
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise _invalid_date(field, value, "Expected a valid YYYY-MM-DD calendar date") from exc


def _filters(
    district: str | None = None,
    from_date: str | None = Query(None, alias="from", pattern=DATE_PATTERN),
    to_date: str | None = Query(None, alias="to", pattern=DATE_PATTERN),
):
    if from_date is None and to_date is None:
        end = datetime.now(ISTANBUL).date()
        start = end - 29 * ONE_DAY
    else:
        if from_date is None:
            raise _invalid_date("from", None, "Required when to is supplied")
        if to_date is None:
            raise _invalid_date("to", None, "Required when from is supplied")
        start = _parse_date("from", from_date)
        end = _parse_date("to", to_date)
        if start > end:
            raise _invalid_date("to", to_date, "Must be on or after from")

    try:
        start_utc = datetime.combine(start, time.min, ISTANBUL).astimezone(timezone.utc)
    except OverflowError as exc:
        raise _invalid_date("from", from_date, "Date is outside the supported calendar") from exc
    try:
        end_utc = datetime.combine(end + ONE_DAY, time.min, ISTANBUL).astimezone(timezone.utc)
    except OverflowError as exc:
        raise _invalid_date("to", to_date, "Date is outside the supported calendar") from exc
    return AnalyticsFilters(district, start, end, start_utc, end_utc)


def read_analytics_facilities(connect, district):
    """Read public facility metadata with the same DB connection settings as the app."""
    with connect() as conn:
        return conn.execute(
            """
            SELECT id, name, district, status
            FROM toilets
            WHERE (%s::text IS NULL OR district = %s)
            ORDER BY district, name, id
            """,
            (district, district),
        ).fetchall()


@dataclass
class ReviewTotals:
    score: int = 0
    count: int = 0

    def add(self, score):
        self.score += score
        self.count += 1

    def average(self):
        return self.score / self.count if self.count else None


def summarize_analytics(filters, facilities, reviews):
    overall = ReviewTotals()
    totals_by_facility = defaultdict(ReviewTotals)
    totals_by_day = defaultdict(ReviewTotals)

    for review in reviews:
        score = review["cleanliness_score"]
        day = review["created_at"].astimezone(ISTANBUL).date()
        overall.add(score)
        totals_by_facility[str(review["toilet_id"])].add(score)
        totals_by_day[day].add(score)

    rows = []
    for facility in facilities:
        facility_id = str(facility["id"])
        total = totals_by_facility[facility_id]
        rows.append({
            "facility_id": facility_id, "name": facility["name"],
            "district": facility["district"], "status": facility["status"],
            "hygiene_score": total.average(), "review_count": total.count,
        })

    trend = []
    for offset in range((filters.end - filters.start).days + 1):
        day = filters.start + offset * ONE_DAY
        total = totals_by_day.get(day, ReviewTotals())
        trend.append({
            "date": day.isoformat(), "average_cleanliness": total.average(),
            "review_count": total.count,
        })

    active_ratio = None
    if rows and all(row["status"] is not None for row in rows):
        active_ratio = {
            "active": sum(row["status"] == "ACTIVE" for row in rows), "total": len(rows),
        }
    average = overall.average()
    return {
        "filters": filters.as_dict(), "average_cleanliness": average,
        "review_count": overall.count, "critical_threshold": CRITICAL_THRESHOLD,
        "critical_alert": average is not None and average < CRITICAL_THRESHOLD,
        "active_facility_ratio": active_ratio, "trend": trend, "facilities": rows,
    }


def _export(summary, export_format):
    rows = [
        {key: facility.get(key) for key in EXPORT_COLUMNS}
        for facility in summary["facilities"]
    ]
    if export_format == "json":
        return {"filters": summary["filters"], "count": len(rows), "results": rows}

    csv_text = StringIO(newline="")
    writer = csv.DictWriter(csv_text, fieldnames=EXPORT_COLUMNS)
    writer.writeheader()
    writer.writerows(rows)
    filters = summary["filters"]
    dates = f'{filters["from"]}_{filters["to"]}'
    district = re.sub(r'[^\w -]', "_", filters["district"] or "all")
    filename = f"smartloo-hygiene-{district}-{dates}.csv"
    fallback = f"smartloo-hygiene-{dates}.csv"
    if filename.isascii():
        fallback = filename
    return Response(
        csv_text.getvalue().encode("utf-8-sig"), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{fallback}"; filename*=UTF-8\'\'{quote(filename)}'},
    )


def create_analytics_router(require_admin, read_facilities, read_reviews):
    """Build both routes with the app's admin guard and configured data stores.

    The review reader accepts (facility_ids, inclusive_start_utc, exclusive_end_utc).
    Store adapters raise AnalyticsUnavailable when an underlying service is down.
    """
    router = APIRouter(prefix="/api/v1/admin", dependencies=[Depends(require_admin)])

    def collect(filters):
        try:
            facilities = read_facilities(filters.district)
            ids = [str(facility["id"]) for facility in facilities]
            reviews = read_reviews(ids, filters.start_utc, filters.end_utc) if ids else []
        except AnalyticsUnavailable as exc:
            raise HTTPException(status_code=503, detail="Analytics data temporarily unavailable") from exc
        return summarize_analytics(filters, facilities, reviews)

    @router.get("/metrics/summary")
    def summary(filters: AnalyticsFilters = Depends(_filters)):
        return collect(filters)

    @router.get("/analytics/export")
    def export(format: Literal["csv", "json"], filters: AnalyticsFilters = Depends(_filters)):
        return _export(collect(filters), format)

    return router
