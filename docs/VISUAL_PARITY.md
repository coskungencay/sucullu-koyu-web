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

---

# Sprint 2 Eki — Etkileşim Parity Raporu

**Tarih:** 23 Temmuz 2026

## Sprint 1 regression (değişmemesi gereken alanlar)

Sprint 2 kodu üzerinden clone yeniden yakalandı
(`reference/screenshots/clone-sprint2/`) ve **Sprint 1 kaynak golden'larına
dokunulmadan** onlarla diff alındı (`diff-sprint2-regression/`):

- 22/22 section screenshot'ı: **%0.000** (değişim yok)
- Full-page: 1440 %0.463, 1366 %0.362, 1024 %0.018, 768 %0.368, 390 %0.027,
  360 %0.003 — hepsi Sprint 1 değerleriyle aynı bantta veya daha iyi; kötüleşme yok.
- Üst bant farkları yine `background-attachment: fixed` stitching artefaktı
  (bkz. yukarıdaki "Bilinen artefaktlar" §1); gerçek layout farkı değildir.

## Interaction golden'ları (kaynak vs clone, MASKESİZ galeri/lightbox)

Yakalama: `scripts/capture-interactions.mjs` — font + hero settle, lazy
görsellerin yüklenmesi ve animasyonların bitmesi beklenerek. Dizinler:
`reference/screenshots/interactions/{source,clone,diff}`.

| Senaryo | 1440×900 | 390×844 |
|---|---:|---:|
| Galeri başlangıç (12) | %0.000 | %0.000 |
| Galeri expanded (53) | %0.000 | %0.000 |
| Lightbox ilk görsel | %0.000 | %0.000 |
| Lightbox orta (27/53) | %0.000 | %0.000 |
| Lightbox son (53/53) | %0.000 | %0.000 |
| Galeri kartı hover | %0.000 | — |
| Lightbox next hover | %0.000 | — |
| Lightbox kontrolleri (alt yarı) | — | %0.000 |
| Mobile menu açık | — | %0.006 |
| Navbar scrolled | %0.000 | %0.000 |
| Video bölümü | %0.000 | %0.000 |
| Focus-visible örneği | — | clone-only golden |

Notlar:

1. **Navbar scrolled ilk ölçümde %0.305 çıkmıştı** — 120 px'lik şeride giren
   stats sayaçlarının 2 sn'lik animasyonu iki tarafta farklı anda yakalanmıştı.
   Capture script'i sayaç settle'ını bekleyecek şekilde düzeltildi; fark %0.000.
   Gerçek bir layout/tasarım farkı değildi.
2. **Mobile menu %0.006** — menü kenarı/hamburger X'inde birkaç antialias
   pikseli; eşiklerin çok altında.
3. **Focus-visible golden'ı yalnızca clone'dan alınır**: kaynak sitede galeri
   kartları klavyeyle odaklanabilir değildir (erişilebilirlik eklentimiz),
   dolayısıyla kaynak karşılığı yoktur.
4. Expand öncesi lightbox sayacı kaynakta görünür set üzerinden hesaplanır
   ("1 / 12"); clone bu davranışı birebir korur (E2E ile sabitlenmiştir).

---

# Sprint 3 Eki — Kamera UI Parity Raporu

**Tarih:** 23 Temmuz 2026
**Yakalama:** `scripts/capture-camera.mjs` — iki tarafta da AYNI prosedür:
fontlar settle, kaynak duvar için 20 sn offline oturma beklemesi, CSS
animasyonları dondurulur (spinner/pulse/blink fazı yakalama anına bağlı
olduğundan; her iki tarafa aynı işlem), duvarda `#clock` maskeli.
Dizinler: `reference/screenshots/camera/{source,clone,diff}`.

## Kaynak ↔ clone karşılaştırmaları

| Senaryo | Diff |
|---|---:|
| Duvar offline 1440×900 | %0.000 |
| Duvar offline 1366×768 | %0.000 |
| Duvar offline 390×844 (kaynak 3×3 birebir) | %0.000 |
| Duvar offline 360×800 (kaynak 3×3 birebir) | %0.000 |
| Duvar tek hücre büyütülmüş | %0.000 |
| Duvar alt bar görünür | %0.000 |
| Duvar mute active (SES AÇ + active) | %0.000 |
| Ana sayfa kamera CTA hover | %0.000 |
| Ana sayfa kamera section | %0.196 * |
| Ana sayfa kamera kartı hover | %0.196 * |

\* **Dinamik durum zamanlaması, layout farkı değil:** kaynak ana sayfa
kartları NXDOMAIN nedeniyle loading↔offline arasında salınır ve yakalama
anında "Bağlantı Yok" gösteriyordu; clone'un disabled varsayılanı spinner'da
bekler. Kanıt: clone `?cam=mock-offline` görünümü kaynağın offline anıyla
diff'lendiğinde **%0.000** (`home-camera-offline` golden'ı). İkon/metin
konumları birebir aynıdır.

## Clone-only golden'lar (kaynakta üretilemez)

- `wall-mock-loading-1440x900` — tüm hücreler BAĞLANIYOR
- `wall-mock-live-1440x900` — 9/9 AKTİF, tüm rozetler CANLI
- `wall-mock-live-3of9-1440x900` — 3/9 AKTİF deterministik karışık durum
- `home-camera-offline/live-1440x900` — ana sayfa mock durumları

## Sprint 1 + Sprint 2 regression (Sprint 3 build'i üzerinde)

- Sprint 1: 22/22 section **%0.000**; full-page farkları bilinen fixed-bg
  stitching artefakt bandında (≤%0.95; kod değişmeden yapılan baseline
  yeniden-çekiminde de aynı bant gözlendi), hero viewport ≤%0.05.
- Sprint 2: 17/18 interaction golden'ı **%0.000**. `mobile-menu-open` tek
  koşuda %0.291 ölçüldü; aynı build'in ardışık yakalamaları kaynak golden'la
  **%0.000 / %0.002 / %0.005 / %0.051** eşleşti ve aynı build'in iki
  yakalaması arasında da %0.291 gözlendi → tek seferlik capture/render
  jitter'ı (bimodal metin antialias), kod regresyonu değil.
- Sprint 1/2 golden'ları DEĞİŞTİRİLMEDİ.
