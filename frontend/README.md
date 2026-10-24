# SmartLoo frontend

> **Provisional host.** The shared React skeleton is owned by #23. Until it lands, this
> folder contains only a minimal Vite + React host so the admin panel (#29) can run.
> When #23 is merged, `src/features/admin/` moves into the shared app unchanged and this
> `package.json` / `vite.config.js` are replaced by the shared ones (agree with Özgür/Furkan).

## Run

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
npm test        # unit tests for metrics, dates, export and sample adapter
```

## Admin analytics panel (`src/features/admin/`)

| Path | Purpose |
|---|---|
| `AdminDashboard.jsx` | Analytics tab of the Administration screen (FR-06, FR-07 export). Proposed route: `/admin`. |
| `api/contract.js` | Endpoint paths, threshold, export columns — mirrors [the API contract](../docs/contracts/admin-analytics-api.md). |
| `api/sampleAdapter.js` | **Sample data**, labelled on screen. Includes a demo scenario switch for loading / 500 / 401 / 403 states. |
| `api/httpAdapter.js` | Real endpoint adapter. **Not wired in** — the endpoints still return 501. |
| `api/metrics.js` | Reference aggregation used by the sample adapter (review-weighted mean, null for no data). |

What is **not** done here: live backend integration, authentication, and RBAC. Hiding the
admin route is not security — the backend must return 401/403.
