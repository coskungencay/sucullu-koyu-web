# sucullu-koyu-web

`www.sucullukoyu.com` sitesinin birebir yeniden yapımı (kaybolan kaynak kodun
yeniden oluşturulması). Bağlayıcı şartname: `sucullu-cto-pack/SUCULLU_KOYU_CLONE_CTO_PACK.md`.

İki rota: `/` (ana sayfa) ve `/canli-kamera.html` (kamera duvarı).

## Çalıştırma

```bash
npm install
npm run dev        # geliştirme sunucusu
npm run build      # tsc --noEmit + vite build → dist/
npm run preview    # production build önizleme (port 4173 için: -- --port 4173)
```

## Test

```bash
npm run test:unit      # Vitest — kamera config, URL builder, backoff, sayaç biçimi
npm run test:e2e       # Playwright — smoke + davranış (preview server'ı kendisi açar)
npm run lint           # ESLint
npm run format:check   # Prettier
npm run verify:assets  # assets-manifest.json SHA-256 bütünlük kontrolü
```

## Galeri ve lightbox davranışları (Sprint 2)

Kaynak `js/main.js` davranışlarının birebir portu:

- İlk yükte 12 görsel görünür; **Tüm Fotoğrafları Göster** 41 gizli görseli
  açar ve buton gizlenir (geri daraltma yok, kaynakta da yoktur).
- Karta tıklama/Enter/Space lightbox'ı açar; sayaç kaynak gibi *görünür* set
  üzerinden hesaplanır (expand öncesi "1 / 12", sonrası "1 / 53").
- İleri/geri butonları ve ArrowRight/ArrowLeft modulo wrap ile gezinir
  (1 ↔ 53); Escape, kapat butonu ve overlay tıklaması kapatır.
- Açıkken body scroll kilitlenir; kapanınca önceki değer geri yüklenir.
- Erişilebilirlik: `role="dialog"`/`aria-modal`, focus yönetimi ve
  focus-visible stilleri — bkz. `docs/ACCESSIBILITY.md`.

Not: `tests/e2e/video.spec.ts` branded Chrome kanalıyla koşar (Playwright
Chromium'da H.264 codec'i yoktur); makinede Google Chrome kurulu olmalıdır.

## Görsel parity araçları

```bash
# Kaynak siteden referans screenshot matrisi (6 viewport):
node scripts/capture-source-reference.mjs --base https://www.sucullukoyu.com --out reference/screenshots/source
# Clone'dan (preview açıkken):
node scripts/capture-source-reference.mjs --base http://localhost:4173 --out reference/screenshots/clone
# Piksel diff raporu (dizinler parametrik):
node scripts/diff-screenshots.mjs
# Sprint 2 interaction golden'ları (galeri/lightbox/hover/mobil menü):
node scripts/capture-interactions.mjs --base https://www.sucullukoyu.com --out reference/screenshots/interactions/source
node scripts/capture-interactions.mjs --base http://localhost:4173 --out reference/screenshots/interactions/clone --clone-extras
node scripts/diff-screenshots.mjs --source reference/screenshots/interactions/source --clone reference/screenshots/interactions/clone --out reference/screenshots/interactions/diff
```

Sonuçlar ve yöntem: `docs/VISUAL_PARITY.md`.

## Kamera yapılandırması

`VITE_CAMERA_BASE_URL` boşken (varsayılan) hiçbir kamera ağ isteği yapılmaz;
UI kaynakla aynı loading/offline durumunu gösterir. Bkz. `.env.example` ve
`docs/CAMERA_HANDOFF.md`. Kamera adı/sırası tek kaynağı:
`src/camera/camera-current-map.json`.

## Dizinler

- `public/gorseller/` — orijinal byte'larıyla dondurulmuş 56 medya dosyası (`assets-manifest.json` ile hashli)
- `public/fonts/`, `public/vendor/fontawesome/` — self-host fontlar ve FA 6.5.1
- `reference/source-html/` — kaynak sitenin ham HTML/CSS/JS snapshot'ı (23.07.2026)
- `reference/screenshots/{source,clone,diff}/` — görsel parity kanıtları
- `docs/` — SOURCE_AUDIT, ASSET_PROVENANCE, VISUAL_PARITY, CAMERA_HANDOFF

## Sprint durumu

- ✅ Sprint 0 — Forensic snapshot
- ✅ Sprint 1 — Ana sayfa statik parity
- ✅ Sprint 2 — Galeri 12→53, lightbox, klavye/erişilebilirlik, video testleri
- ⏳ Sprint 3 — Kamera UI parity + player lifecycle (onay bekliyor)
- ⏳ Sprint 4 — Hardening

Production deploy, DNS değişikliği ve gerçek kamera entegrasyonu ayrı onay gerektirir.
