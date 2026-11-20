# SmartLoo frontend

One React app for every screen: one header, one router and one session.

## Run

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173, /api is proxied to http://localhost:8000
npm test        # unit and static-render tests (no browser needed)
npm run build
```

Start the FastAPI backend on port 8000 for live data (see the root README). Set
`VITE_API_BASE_URL` only when the API is served from another origin.

## Structure and ownership (#55)

| Path | Purpose | Owner |
|---|---|---|
| `src/main.jsx`, `src/app/` | Entry, routes (`/`, `/sign-in`, `/register`, `/account`, `/admin`), header, account menu | Onur (with Furkan) |
| `src/shared/http/apiClient.js` | Shared HTTP client: Bearer token, `ApiError`, FastAPI 422 field errors, one 401 handler | Onur |
| `src/shared/session/` | `SessionProvider` / `useSession()`: sign-in, register, sign-out, 60-minute expiry | Onur |
| `src/features/auth/` | Sign In, Register, Account screens and the `RequireRole` screen gate (FR-08) | Onur |
| `src/features/admin/` | Admin analytics and export (FR-06, FR-07) | Onur |
| `src/app/HomeRoute.jsx` → map | Discovery map, details and reviews plug into `/` | Furkan |

Feature components call the backend through the session's client:

```jsx
const { session, api } = useSession();
const data = await api.request("/api/v1/toilets/nearby", { query: { lat, lon, radius }, auth: false });
```

## Session rules

- `POST /api/v1/auth/login` returns a 60-minute JWT. Role and expiry are read from its claims for display only; the backend checks every protected call.
- The token is kept in `sessionStorage` (survives a reload, cleared when the tab closes), never in `localStorage` or cookies. It is dropped at `exp`.
- Any 401 for a request that carried the token ends the session everywhere and asks the user to sign in again. 403 shows an access message and keeps the session.
- Signing out clears the token locally. FR-08 has no server-side logout.

## Admin data modes

| Mode | How | Behaviour |
|---|---|---|
| Live (default) | `npm run dev` | Requires a real ADMIN session; calls `GET /api/v1/admin/metrics/summary` and `/analytics/export`. No demo controls. Until the backend implements them, the panel shows “not ready (501)”. |
| Sample | `VITE_ADMIN_DATA=sample npm run dev` | Labelled sample adapter for UI review without a backend. Applies no session or role checks and is never used in the live flow. |

Hiding a screen is not security: the backend must return 401/403.
