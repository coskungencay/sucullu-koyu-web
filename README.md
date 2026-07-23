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

## Görsel parity araçları

```bash
# Kaynak siteden referans screenshot matrisi (6 viewport):
node scripts/capture-source-reference.mjs --base https://www.sucullukoyu.com --out reference/screenshots/source
# Clone'dan (preview açıkken):
node scripts/capture-source-reference.mjs --base http://localhost:4173 --out reference/screenshots/clone
# Piksel diff raporu:
node scripts/diff-screenshots.mjs
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
- ✅ Sprint 1 — Ana sayfa statik parity (galeri: statik iskelet + ilk 12 görsel)
- ⏳ Sprint 2 — Galeri 12→53, lightbox, video etkileşim testleri (onay bekliyor)
- ⏳ Sprint 3 — Kamera UI parity + player lifecycle
- ⏳ Sprint 4 — Hardening

Production deploy, DNS değişikliği ve gerçek kamera entegrasyonu ayrı onay gerektirir.
