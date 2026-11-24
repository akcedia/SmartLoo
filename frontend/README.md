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
| `src/main.jsx`, `src/app/` | Entry, routes (`/`, `/sign-in`, `/register`, `/account`, `/admin`, `/admin/import`), header, account menu | Onur (with Furkan) |
| `src/shared/http/apiClient.js` | Shared HTTP client: Bearer token, `ApiError`, FastAPI 422 field errors, one 401 handler | Onur |
| `src/shared/theme/` | Light/dark theme tokens and the header theme switch ([rules](../docs/design/ui-theme.md)) | Onur |
| `src/shared/i18n/` | Shared TR/EN language structure and header switch ([how to use](../docs/design/i18n.md)) | Onur |
| `src/shared/session/` | `SessionProvider` / `useSession()`: sign-in, register, sign-out, 60-minute expiry | Onur |
| `src/features/auth/` | Sign In, Register, Account screens and the `RequireRole` screen gate (FR-08) | Onur |
| `src/features/admin/` | Admin analytics and export (FR-06, FR-07), CSV/JSON import tab in `import/` (FR-07) | Onur |
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

## Admin import (`/admin/import`)

Uploads one CSV or JSON file to `POST /api/v1/admin/import` ([contract](../docs/contracts/admin-import-api.md)) with the shared client's `rawBody`, so the bytes are sent unchanged as `text/csv` or `application/json`. The screen checks size, record count and JSON shape first, asks for confirmation, sends one request and shows inserted / updated (matched) / unchanged / rejected. A 422 lists the row errors and nothing is written; nothing is retried automatically.

Live check against real services (private test database only; it writes rows under its own unique `source` and deletes them):

```bash
SMARTLOO_TEST_POSTGIS=1 SMARTLOO_TEST_MONGO=1 python scripts/check_map_reviews_live.py --suite import
```

On Windows set `SMARTLOO_DB_HOST=127.0.0.1` and `SMARTLOO_MONGO_URL=mongodb://127.0.0.1:27017`.

## Admin data modes

| Mode | How | Behaviour |
|---|---|---|
| Live (default) | `npm run dev` | Requires a real ADMIN session; calls `GET /api/v1/admin/metrics/summary`, `/analytics/export` and `POST /admin/import`. No demo controls. |
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
ekran kullanılamama mesajı gösterir. Gerçek model ve öneriler ayrı kalan işlerdir;
İBB konum verisi main'de entegredir. Bu kontrol #57/#56'nın tamamını kapatmaz.

### Hesap silme ekranı ve gerçek backend (#63 / #75)

`Hesabım` ekranı açık onay sonrasında `DELETE /api/v1/users/me` çağırır.
Yalnız 204 yanıtında oturumu temizleyip misafir haritasına döner. 503 ve
bağlantı hatalarında başarı göstermez; 401 ortak oturumu kapatır. Yanıtın
kaybolması silmenin gerçekleşmediğini kanıtlamadığı için mesaj sonucu belirsiz
bırakır. Onaydan vazgeçme/Escape ve başarısız istek odağı silme düğmesine döndürür.

Yukarıdaki test ortamında, migration 007 dahil tüm migration'lar uygulandıktan
sonra `python scripts/check_map_reviews_live.py --suite deletion` çalıştırılır.
Kontrol ayrı sentetik tesisler/hesaplar ve geçici MongoDB veritabanı kullanır:

- Vazgeçme/Escape, odak dönüşü ve korunmuş oturum.
- Gerçek bekleyen yazar işlemi nedeniyle 503; hesap ve oturum korunur.
- Gerçek 204; hesap silinir, eski giriş/token 401 alır, anonim yorum ve ortalama korunur.
- Eski oturumla silme isteğine gerçek 401; ortak oturum kapanır.
- Sunucu silmeyi tamamladıktan sonra yanıtın kaybolması; ekran yanlış sonuç
  bildirmez, yeniden denemede 401 ile oturum kapanır.

`Account deletion live integration` temiz GitHub ortamında bu beş kontrolü
çalıştırır; JUnit kapısı sıfır hata/atlama ve en az beş başarı ister. Bunlar
jsdom + gerçek HTTP/veritabanı kontrolleridir; görsel tarayıcı veya mobil kabulü
olarak değerlendirilmemelidir. Öneri kaydı temizliği ve canlı AI entegrasyonu
ayrı iş olarak kalır.
