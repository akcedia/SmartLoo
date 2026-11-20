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

# Harita ve yorum entegrasyonu — 20 Kasım 2026

`HomeRoute` içindeki `MapApiProvider`, harita/detay/yorum/AI ekranlarına ortak
`SessionProvider` oturumunu ve HTTP istemcisini verir. Ayrı token depolama ya da
JWT ayrıştırma kullanılmaz. Token içeren bir isteğe 401 gelirse üst menü ve
yorum formu birlikte misafir durumuna döner; 403 oturumu kapatmaz. Tarayıcı
depolaması kapalıyken bellekteki ortak oturum da kullanılabilir.

Yerel doğrulama (Windows, Node 26.13.0, main `4050605` + PR #73 `25da0b9`):

- `npm test`: 94 geçti, sıfır başarısız/atlanan; `npm run build`: başarılı.
- Gerçek FastAPI HTTP + PostGIS + MongoDB ve gerçek JWT ile monte edilmiş React
  testi: 9 geçti, sıfır başarısız/hata/atlanan. Bunların 8'i normal arayüz
  paketinde de bulunur; toplam 95 farklı testtir.
- Yorum ekleme/düzenleme/silme, başka USER için 403, ADMIN için yalnız silme
  görünürlüğü, detay puanının yenilenmesi, son yorum silinince null/0 ve gerçek
  sunucunun reddettiği JWT sonrası ortak oturumun kapanması doğrulandı.

Canlı entegrasyonu yeniden çalıştırmak için önce ortak test ortamını kurup
migration'ları uygulayın ve `frontend` içinde `npm ci` çalıştırın. Node 24.15+
veya 26, ortak Python bağımlılıkları ve ayrı test veritabanları gerekir.
Depo kökünden, kendi test portlarınızla:

```powershell
$env:SMARTLOO_TEST_POSTGIS = '1'
$env:SMARTLOO_TEST_MONGO = '1'
$env:SMARTLOO_DB_HOST = '127.0.0.1'
$env:SMARTLOO_DB_PORT = '5436'
$env:SMARTLOO_MONGO_URL = 'mongodb://127.0.0.1:27019'
python scripts/check_map_reviews_live.py
```

Kontrol kendi tesisini, üç hesabını ve geçici MongoDB veritabanını oluşturup
sonunda temizler. `SMARTLOO_MAP_JUNIT` verilirse JUnit çıktısı da yazar.
`Map review live integration` iş akışı aynı kontrolü temiz GitHub ortamında
çalıştırır ve en az 9 başarılı, sıfır atlanan test ister. Dal korumasına yeni
zorunlu kontrol eklenmesi bu değişikliğe dahil değildir.

Bu kanıt jsdom üzerinde etkileşim ve gerçek HTTP/veritabanı entegrasyonudur;
mobil/klavye tarayıcı kabulü değildir. AI uçları henüz main'de 501 döner ve
ekran kullanılamama mesajı gösterir. Gerçek model, öneriler ve İBB veri aktarımı
ayrı kalan işlerdir; bu değişiklik #57/#56'nın tamamını kapatmaz.
