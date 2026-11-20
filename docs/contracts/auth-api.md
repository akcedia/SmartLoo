# Auth API contract (FR-08)

Owner: Fırat Karadoğan ([#56](https://github.com/akcedia/SmartLoo/issues/56), [#51](https://github.com/akcedia/SmartLoo/pull/51)). For the shared session client (Onur, Furkan) and protected backend routes (Özgür). Examples below are real responses from `src/auth.py`; values such as ids and tokens differ per run.

**Status.** Implemented and tested with PostgreSQL. Review CRUD and account deletion are implemented; suggestion submission remains separate integration work.

## Register

`POST /api/v1/auth/register`

```json
{"email": "Ayse@Example.com", "password": "Guvenli123", "display_name": "Ayşe"}
```

| Status | Body | When |
| --- | --- | --- |
| 201 | `{"id": "a243b084-…", "email": "ayse@example.com", "display_name": "Ayşe", "role": "USER"}` | Created. Email is stored lower-case. A `role` field in the request is ignored. |
| 409 | `{"detail": "Email is already registered"}` | Same email in any letter case |
| 422 | `{"detail": [{"loc": ["body", "password"], "msg": "Value error, Password needs at least 8 characters, a letter and a digit", …}]}` | FastAPI validation list; `loc[1]` names the field |

Rules: password 8+ characters with a letter and a digit, at most 72 bytes in UTF-8 (Turkish letters count 2 bytes); display name 3–30 characters; valid email up to 254 characters.

## Sign in

`POST /api/v1/auth/login`

```json
{"email": "ayse@example.com", "password": "Guvenli123"}
```

| Status | Body | When |
| --- | --- | --- |
| 200 | `{"access_token": "eyJhbGciOiJIUzI1NiIs…", "token_type": "Bearer", "expires_in": 3600}` | Valid credentials |
| 401 | `{"detail": "Invalid email or password"}` | Wrong password or unknown email (same message on purpose) |
| 429 | `{"detail": "Too many failed attempts. Try again later."}` | 5 failures for this email in the last 15 minutes; even the right password waits |
| 503 | `{"detail": "Authentication is not configured"}` | Server has no `SMARTLOO_JWT_SECRET` |

The token is a signed HS256 JWT with `sub` (user UUID), `role` (`USER` or `ADMIN`), `iat` and `exp` (`iat` + 3600 s). The client may read `role` to choose screens, but the server re-checks every request. There is no refresh token: after 60 minutes, or on any 401, send the user back to sign in.

## Calling protected routes

Send `Authorization: Bearer <access_token>`.

| Status | Body | Client action |
| --- | --- | --- |
| 401 | `{"detail": "Authentication required"}` (no token) or `{"detail": "Invalid or expired token"}` | Clear the stored token, show sign-in. Also returned when the account was deleted. Response has `WWW-Authenticate: Bearer`. |
| 403 | `{"detail": "Administrator role required"}` | Signed in but not allowed; keep the session, show "no permission" |

| Guard | Routes |
| --- | --- |
| Signed in (`current_user`) | `POST /toilets/suggest`, `POST /toilets/{id}/reviews`, `PATCH`/`DELETE /reviews/{id}`, `DELETE /users/me` |
| ADMIN (`require_admin`) | every `/api/v1/admin/**` route |
| Public | search, facility details, reading reviews and summaries, recommendations |

Backend usage:

```python
from fastapi import Depends
from src.auth import Principal, current_user, require_admin

def summary(admin: Principal = Depends(require_admin)): ...   # admin.sub, admin.role
```

## Delete my account (FR-10)

`DELETE /api/v1/users/me` with `Authorization: Bearer <access_token>`.

| Status | Body | Meaning |
| --- | --- | --- |
| 204 | none | Account row (email, display name, password hash) and sign-in history removed. Reviews stay with `user_id = null`, shown as `"Anonymous"`; their text has the author's email, display name and any email or phone number replaced by `[removed]`. Scores are kept, so averages do not change; each affected toilet's `review_version` moves, so old AI summaries are not reused. |
| 401 | `{"detail": "Authentication required"}` / `{"detail": "Invalid or expired token"}` | No token, or the account is already deleted. The old token stops working immediately. |
| 503 | `{"detail": "..."}` | A review could not be anonymized consistently. The account is **not** deleted yet; retry the same request. |

Client: after 204, clear the stored token and return to the map as a guest. Ask for confirmation before calling; there is no undo.

Account deletion and review mutations acquire the same account guard before any
facility guard. They recheck account existence and current role under that guard;
an already validated request cannot write after account removal. PostgreSQL uses
one session for both guards and the review journal. Migration 007 records the
author even for a pending creation with no before-document. A pending author
operation blocks deletion across application restarts, including when Mongo has
already lost the author link. Repair the affected facility with the review
service's `reconcile()` before retrying in that case.

The SQL account/sign-in-history transaction runs only after all author documents
and recovery records are cleared. Completed anonymizations stay completed on a
later failure; retry skips them. No Mongo cleanup runs after account removal.
This endpoint does not implement suggestion cleanup for a future suggestion store.

Verification on 21 November (Python 3.13, PostGIS 16-3.4, MongoDB 7):
the required deletion suite runs 8 isolated cases, 6 real-database cases and
TC-34, with 15 passed and zero failures/errors/skips. Cases cover stale
prevalidated writes, pending creation before Mongo insertion, failed compensation
across app instances, SQL deletion rollback and actual server-side session loss.
The shared backend regression suite also passed all 133 cases without skips.
CI runs deletion as a required database suite and rejects skipped/incomplete runs.

## Demo accounts

There is no public admin registration. Register normally, then promote the account in the local database:

```powershell
docker compose exec -T postgis psql -c "UPDATE users SET role = 'ADMIN' WHERE email = 'demo-admin@example.com'"
```

The role is read from the database on every request, so the existing token works as ADMIN immediately. Use synthetic addresses such as `demo-admin@example.com`; never real personal data.
