# DEPLOYMENT — Dağıtım Dokümanı (Sprint 4)

## Mimari

Statik multi-page site → multi-stage Docker → nginx.

- **Build stage:** `node:22.16.0-alpine` → `npm ci` → asset SHA-256 doğrulaması
  (56/56, başarısızsa build durur) → `npm run build` (tsc + vite).
- **Runtime stage:** `nginx:1.27-alpine`; yalnızca `dist/` + `nginx.conf`.
  Kaynak kod, testler, reference klasörleri, docs runtime image'a girmez
  (container'da doğrulandı).
- Port: 80 · Health: `GET /healthz` → 200 `ok` (statik dosya `public/healthz`).

## Lokal doğrulama

```bash
docker build -t sucullu-koyu-web .
docker run -d --name sucullu -p 8090:80 sucullu-koyu-web
curl -i http://localhost:8090/healthz
```

Smoke sonuçları (23.07.2026): `/` 200, `/canli-kamera.html` 200, `/healthz`
200, JS/CSS/font/görsel MIME'ları doğru, MP4 Range → 206, bilinmeyen rota 404,
dotfile 404, gzip aktif (CSS 19.5 KB→4.3 KB), restart sonrası erişim OK,
console error 0, kamera isteği 0.

## nginx kararları

- **SPA fallback YOK** — proje multi-page; bilinmeyen rota 404 döner.
- HTML + `/healthz`: `expires -1` (no-cache). `/assets/` (Vite hash'li):
  1 yıl. `/gorseller|fonts|vendor/`: 30 gün. Cache için yalnızca `expires`
  kullanılır — location içi `add_header`, server seviyesindeki güvenlik
  başlıklarının kalıtımını düşürür (bilinen nginx tuzağı).
- `server_tokens off`, dotfile deny, directory listing kapalı (autoindex
  varsayılan off + `try_files`), kamera endpoint proxy'si YOK.

## Security headers / CSP

`X-Content-Type-Options: nosniff` · `Referrer-Policy:
strict-origin-when-cross-origin` · `Permissions-Policy: camera=(),
microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)`
(duvarın tam ekranı için `fullscreen=(self)` gerekli) · `X-Frame-Options:
SAMEORIGIN` + CSP `frame-ancestors 'self'` (clickjacking).

CSP (tam değer `nginx.conf` içinde):

- `script-src 'self'` — inline script yok, `unsafe-eval` yok.
- `style-src 'self' 'unsafe-inline'` — **gerekçe:** kaynak sitenin birebir
  kopyalanan inline `<style>` blokları (ana sayfa kamera bölümü ve kamera
  duvarı kaynakta inline'dır; parity gereği taşınamaz). Kapsam yalnızca
  style'dır; script'lere inline izni yoktur.
- `connect-src/media-src` → `'self'` + `https://kameraizle.sucullukoyu.com`
  (ileride live mod HLS manifest/segment istekleri) + `blob:` (MSE).
- `worker-src 'self' blob:` — hls.js `enableWorker` inline worker'ı.
- `img-src 'self' data:` — emoji favicon data URI'si.
- `frame-src https://www.google.com` — Maps embed.
- `object-src 'none'; base-uri 'self'; form-action 'self'`.

Tarayıcı doğrulaması (lokal container, Playwright): ana sayfa + harita +
video, galeri lightbox, kamera mock modları, kamera duvarı senaryolarında
**CSP ihlali 0, console error 0**; Playfair/Inter fontları yüklü (kullanılan
weight'ler `loaded`).

## CI (GitHub Actions)

`.github/workflows/ci.yml` — main/dev push + PR:

- **quality** (ubuntu): Node 22.16.0 pin + npm cache → `npm ci` → format →
  lint → tsc → unit → asset integrity → build → Playwright Chromium
  (`--with-deps`) → **branded Chrome** (`npx playwright install chrome`;
  kurulamazsa adım ve CI FAIL olur — video testleri sessizce skip edilmez) →
  E2E → başarısızlıkta artifact upload.
- **visual** (macos — golden'lar macOS'ta üretildi; farklı OS font
  rasterizer'ı eşikleri anlamsız kılar): build → preview →
  `scripts/ci-visual-check.mjs` — repodaki onaylı golden'lara karşı, canlı
  siteyi yeniden scrape ETMEDEN. Eşikler script içinde belgeli: section ≤%0.35,
  hero ≤%0.60, full-page ≤%1.80 (fixed-bg stitching artefakt bandı). Eşik
  aşımında golden otomatik güncellenmez; güncelleme bilinçli ayrı komuttur.

## Coolify hedef yapılandırması

| Alan | Değer |
|---|---|
| Name | `sucullu-koyu-web` |
| Source | GitHub repo (branch: `main`) |
| Build pack | Dockerfile (`/Dockerfile`) |
| Port | 80 |
| Health | `/healthz`, port 80, beklenen 200 |
| `VITE_CAMERA_BASE_URL` | **boş/unset** (kamera istekleri kapalı) |
| Force domain override | false |
| Domain | Coolify staging/generated domain (HTTPS zorunlu) |

**Güvenlik önkoşulları:** `COOLIFY_API_TOKEN` ve `COOLIFY_BASE_URL` yalnızca
process environment'tan okunur; token hiçbir dosyaya/loga yazılmaz. Base URL
ya geçerli HTTPS ya da SSH tüneli üzerinden `http://127.0.0.1:<port>/api/v1`
olmalıdır — public `http://` IP'ye token gönderilmez. TLS doğrulaması
kapatılmaz. Erişim önce read-only istekle doğrulanır.

## Rollback

DNS değiştirilmediği için mevcut canlı site staging'den etkilenmez. Coolify
resource silinmez; başarısız deploy'da son başarılı deployment'a Coolify
üzerinden rollback yapılır. Git history rewrite / force push yasak.

## Production cutover (AYRI ONAY GEREKTİRİR)

1. Staging'de müşteri görsel onayı (`docs/CLIENT_ACCEPTANCE.md`).
2. Footer yıl/muhtar bilgisi teyidi; canonical/sitemap/robots eklenmesi.
3. `www.sucullukoyu.com` DNS'inin Coolify'a yönlendirilmesi + TLS sertifikası.
4. Eski hosting'in yedeklenmesi; geri dönüş planı.
5. Kamera gerçek entegrasyonu ayrı altyapı fazıdır (`docs/CAMERA_HANDOFF.md`).
