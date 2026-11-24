# Suggestions API contract (FR-05)

Owner: Fırat Karadoğan ([#56](https://github.com/akcedia/SmartLoo/issues/56)). For the suggestion form and the ADMIN moderation screen (Onur, Furkan). Implemented in `src/suggestions.py`, stored by `db/migrations/008_create_suggestions.sql`; tested on real PostgreSQL.

## Suggest a facility (signed in)

`POST /api/v1/toilets/suggest`

```json
{"name": "Moda Sahili WC", "district": "Kadıköy", "latitude": 40.981, "longitude": 29.026,
 "has_disabled_access": true, "has_baby_changing": null, "is_free": null}
```

Amenities are optional; omit or send `null` for unknown.

| Status | When |
| --- | --- |
| 202 | Saved as pending: `{id, status: "pending", name, district, latitude, longitude, has_disabled_access, has_baby_changing, is_free, toilet_id: null, created_at, decided_at: null}`. Not visible in search or on the map. |
| 401 | Not signed in |
| 422 | Blank name or district, name over 150 characters, latitude outside −90..90, longitude outside −180..180 |

## Moderate (ADMIN)

`GET /api/v1/admin/suggestions?status=pending&limit=50&offset=0` returns `{count, results}`, oldest first. `status` is `pending` (default), `approved` or `rejected`.

`PATCH /api/v1/admin/suggestions/{id}` with `{"status": "approved"}` or `{"status": "rejected"}`.

| Status | When |
| --- | --- |
| 200 | Decision saved. On approval `toilet_id` is set and the facility is ACTIVE in search and on the map right away (same transaction); opening hours and unknown amenities stay unknown. |
| 401 / 403 | Not signed in / not ADMIN |
| 404 | No such suggestion |
| 409 | Already approved or rejected (also when two admins decide at the same time) |
| 422 | Any other status value |

Responses never include who submitted or decided a suggestion. When a submitter or moderator deletes their account, the link is cleared and the suggestion and any published facility stay (FR-10).

Open decision (D-3 in the data dictionary): a suggestion that duplicates an existing facility is not detected automatically; the ADMIN rejects it.
