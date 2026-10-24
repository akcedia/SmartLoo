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
