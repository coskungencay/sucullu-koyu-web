# VISUAL_PARITY — Görsel Eşleşme Raporu (Sprint 0 + 1)

**Karşılaştırma tarihi:** 23 Temmuz 2026
**Yöntem:** `scripts/capture-source-reference.mjs` (Playwright/Chromium, tr-TR,
Europe/Istanbul, DSF=1) her iki taraf için aynı prosedürle çalıştırıldı:
fontlar + hero animasyonu settle → kademeli scroll (reveal/counter/lazy tetikleme)
→ başa dön → settled full-page + hero + section screenshot'ları.
Diff: `scripts/diff-screenshots.mjs` (pixelmatch, threshold 0.1).

**Maskeler (dinamik içerik):** `.map-container` (Google Maps) ve `#cameraGrid`
(zaman bağımlı loading/offline döngüsü) her iki tarafta aynı renkle maskelendi.

Kaynak: `https://www.sucullukoyu.com` → `reference/screenshots/source/`
Clone: `http://localhost:4173` (vite preview, production build) → `reference/screenshots/clone/`
Diff görselleri: `reference/screenshots/diff/`

## Full-page sonuçları (6 viewport)

| Viewport | Full-page diff | Hero (viewport) diff | Hedef | Durum |
|---|---:|---:|---|---|
| 1440×900 | %0.565 | %0.016 | ≤%1 | ✅ |
| 1366×768 | %0.000 | %0.015 | ≤%1 | ✅ |
| 1024×768 | %0.026 | %0.001 | ≤%1 | ✅ |
| 768×1024 | %0.437 | %0.019 | ≤%2 | ✅ |
| 390×844 | %0.000 | %0.050 | ≤%2 | ✅ |
| 360×800 | %0.030 | %0.000 | ≤%2 | ✅ |

## Section sonuçları (1440×900 ve 390×844, 11 section × 2)

**22/22 screenshot %0.000 diff** — stats, hosgeldiniz, hakkimizda, tarihce,
mahalleler, galeri, video, ekonomi, canli-kamera, konum, iletisim.

## Yapısal eşleşme

- Section sırası: 13/13 birebir (%100) — E2E ile doğrulanıyor
- Anchor ID'leri: birebir (%100)
- Metinler: kaynak HTML'den kopyalandığı için birebir (%100)
- Medya sayısı/sırası: 53 galeri + 2 + video (%100)
- Sayfa yükseklikleri tüm viewport'larda piksel piksel aynı (ör. 390 genişlikte her iki taraf 14.084 px)

## Bilinen artefaktlar (layout farkı DEĞİL)

1. **Full-page üst bant (~ilk 80 px):** 1440 ve 768 full-page diff'inin tamamı
   sayfanın en üst bandında yoğunlaşıyor. Neden: `background-attachment: fixed`
   hero arka planının Playwright full-page stitching sırasındaki render
   davranışı (fotoğraf pikseli yüksek kontrastlı olduğundan küçük ofset çok
   piksel sayıyor). Viewport (hero) ekran görüntüleri ≤%0.05 olduğundan gerçek
   görünüm eşleşiyor.
2. **scrollWidth 410 px @390 viewport (her iki tarafta aynı):** kaynaktaki
   off-canvas mobil menü (`right: -100%`) ve `welcome` bölümü taşmaları.
   Kaynak davranışı birebir korunuyor (`overflow-x: hidden` ile görünmez).
3. Google Maps ve kamera grid maskeli — canlı harita tile'ları ve zaman bağımlı
   kamera durum döngüsü deterministik karşılaştırılamaz (CTO §11.1 uyarınca).

## Konsol ve asset sağlığı

- Clone: 6 viewport gezintisinde console error **0**; first-party 4xx/5xx **0**
  (E2E ile de sürekli doğrulanıyor). `preload="metadata"` videosunun tarayıcı
  tarafından ERR_ABORTED ile kesilmesi normal davranıştır (kaynakta da var).
- Kaynak: 6 viewport gezintisinde console error 0.

## Sprint 2+ için bekleyen görsel doğrulamalar

- Galeri 53 görsel açık hali, lightbox ilk/orta/son, hover durumları,
  mobil menü açık hali (Sprint 2)
- Kamera duvarı grid/scanline/offline parity ölçümü (Sprint 3)
