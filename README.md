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