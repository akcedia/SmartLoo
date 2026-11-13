# SmartLoo

Weekly integration candidate. The admin panel uses labelled sample data. API features still return 501; no complete map/search demo is claimed.

## Shared layout
- `src/`: FastAPI application factory (`src.app:create_app`). Preserve the existing test injection interface.
- `frontend/`: common React/Vite host, including Onur's admin feature. Furkan adds the discovery map here rather than starting another app.
- `db/`: Fırat's migrations, fixtures and SQL checks.
- `tests/`: requirements acceptance baseline.
- `docs/DESIGN.MD`: architecture and decisions.

## Local setup
Use Python 3.11, Node 20 and Docker Compose. From repository root:
```sh
cp .env.example .env
docker compose up -d --wait
docker compose exec -T postgis sh /db/scripts/migrate.sh
docker compose exec -T postgis sh /db/scripts/check.sh
python -m venv .venv
# Activate .venv for your shell, then:
pip install -r requirements-test.txt
python -m pytest -v
cd frontend
npm ci
npm test
npm run dev
```
The acceptance baseline currently fails on unimplemented 501 responses. Do not interpret the baseline job's permitted failure as implemented features. Frontend and SQL checks are blocking CI jobs. Use `npm run build` for the frontend build.

Root docker-compose.yml is the shared environment; the standalone db/docker-compose.yml is retained for the original contribution. Do not run both at once. Credentials are local development examples only. Changing DB env values does not alter an existing volume's initialized account.

## Team workflow
Start from current main, use a feature branch, reference the issue in a small PR, include actual verification results, and obtain another member's review. Coordinate changes to env names, package files and API contracts. No main merge is implied by this weekly review.

See [weekly status](docs/WEEKLY-2026-10-24.md), [database guide](db/README.md), and [frontend guide](frontend/README.md).

## Nearby search API — local development (#25)

Verified locally with Python 3.13 and Docker Desktop.
Run all commands from the repository root. Examples use PowerShell.

### Install dependencies

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-test.txt
```

### Prepare PostgreSQL/PostGIS

Keep Docker Desktop running.

```powershell
docker compose up -d --wait postgis
docker compose exec -T postgis sh /db/scripts/migrate.sh
docker compose exec -T postgis psql -v ON_ERROR_STOP=1 -f /db/seeds/fixtures.sql
```

Fixtures are synthetic test facilities, not real public toilet data.

The backend reads SMARTLOO_DB_HOST, SMARTLOO_DB_PORT,
SMARTLOO_DB_NAME, SMARTLOO_DB_USER and SMARTLOO_DB_PASSWORD
from the process environment. Defaults match the local Docker setup:
localhost:5432, database/user smartloo, password smartloo-dev-only.

These defaults are for local development only.
The backend does not automatically load a .env file.

### Run the API

```powershell
.\.venv\Scripts\python.exe -m uvicorn src.app:create_app --factory --reload
```

Example:
http://127.0.0.1:8000/api/v1/toilets/nearby?lat=41&lon=29&radius=1000&open_now=true

Interactive API documentation:
http://127.0.0.1:8000/docs

### Search behavior

- Required: lat (-90 to 90), lon (-180 to 180).
- radius: 1–50000 metres; default 1000.
- open_now: default false.
- Optional boolean filters: has_disabled_access,
  has_baby_changing, is_free.
- Unknown amenities match neither true nor false filters.
- Results are ordered by geographic distance, then facility ID.
- Distances are in metres, not walking distances.
- Without open_now=true, closed facilities may appear.
- Opening hours currently support 24/7 and one daily time range.
- Response: {"count": number, "results": [...]}.
- Invalid parameters return 422.
- Database connection failures return 503.

### Run search tests

Isolated contract tests; no database required:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_requirements.py -k "tc_01 or tc_02 or tc_03 or tc_11 or tc_12 or tc_13 or tc_14" -q
```

PostGIS integration tests; requires the database and fixtures above:

```powershell
$env:SMARTLOO_TEST_POSTGIS = "1"
.\.venv\Scripts\python.exe -m pytest tests/test_nearby_postgis.py -q
```

Verified: 10 isolated cases and 5 PostGIS integration cases passed.
Other feature tests are outside this search-only verification.
Map integration and large-dataset performance remain to be verified.
## Accounts and authorization API — local development (#38)

Registration, sign-in and the route guards follow FR-08. They use the same
PostgreSQL database; `migrate.sh` creates the `users` and `login_failures` tables.

The API signs tokens with `SMARTLOO_JWT_SECRET` (at least 32 bytes). Without it,
sign-in and protected routes return 503. Use your own random value; never commit one.

```powershell
$env:SMARTLOO_JWT_SECRET = "replace-with-a-local-random-secret-of-32-bytes"
.\.venv\Scripts\python.exe -m uvicorn src.app:create_app --factory --reload
```

| Request | Result |
| --- | --- |
| `POST /api/v1/auth/register` `{email, password, display_name}` | 201 public account with role USER; 409 email taken (case-insensitive); 422 invalid fields. Password: 8+ characters with a letter and a digit. A supplied `role` is ignored. |
| `POST /api/v1/auth/login` `{email, password}` | 200 `{access_token, token_type: "Bearer", expires_in: 3600}`; generic 401 `Invalid email or password`; 429 after five failures for one email within 15 minutes |

Protected routes use FastAPI dependencies from `src/auth.py`:

```python
from fastapi import Depends
from src.auth import Principal, current_user, require_admin

@app.get("/api/v1/admin/metrics/summary")
def summary(admin: Principal = Depends(require_admin)):
    ...  # admin.sub is the account UUID, admin.role == "ADMIN"
```

`current_user` returns 401 for a missing, tampered or expired token, or when the
account no longer exists. `require_admin` additionally returns 403 for a valid
USER. Review, suggestion and account-deletion routes now check the token, then
still return 501 until those features exist. There is no admin registration
route; promote a local test account with SQL:

```powershell
docker compose exec -T postgis psql -c "UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com'"
```

### Run auth tests

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_requirements.py -k "tc_04 or tc_05 or tc_30 or tc_37 or tc_38 or tc_39 or tc_40 or tc_41 or tc_42 or tc_43 or tc_44 or tc_47 or tc_48" -q
$env:SMARTLOO_TEST_POSTGIS = "1"
.\.venv\Scripts\python.exe -m pytest tests/test_auth_postgres.py -q
```

Verified locally on 13 November 2026: 13 isolated FR-08 cases and 9 PostgreSQL cases passed.
TC-45 (admin analytics 200), TC-46 (review ownership) and TC-34 (account deletion)
need the analytics, review and deletion features and still fail.
