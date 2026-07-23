# LIGHTHOUSE — Ölçüm Raporu (Sprint 4)

**Tarih:** 23 Temmuz 2026 · **Hedef:** lokal production container (nginx, gzip,
security headers aktif) · **Araç:** Lighthouse 13.4.1, headless Chrome ·
Ham raporlar: `docs/lighthouse/*.report.{json,html}`

## Skorlar

| Sayfa / cihaz | Performance | Accessibility | Best Practices | SEO |
|---|---:|---:|---:|---:|
| Ana sayfa — desktop | 88 | **91** ✅ | **100** ✅ | **100** ✅ |
| Ana sayfa — mobile | 61 * | **91** ✅ | **100** ✅ | **100** ✅ |
| Kamera duvarı — desktop | 100 | **97** ✅ | **96** ✅ | **90** ✅ |
| Kamera duvarı — mobile | 100 | **97** ✅ | **96** ✅ | **90** ✅ |

CTO minimumları (A11y ≥90, BP ≥90, SEO ≥90) **tüm sayfa/cihaz kombinasyonlarında
karşılandı.**

## * Ana sayfa mobil performans — dürüst değerlendirme

Metrikler (simüle yavaş 4G): FCP 5.4 s · Speed Index 5.4 s · LCP 12.2 s ·
TBT 0 ms.

Neden: exact-parity zorunluluğu gereği **orijinal medya byte'ları korunuyor**
(ADR-003/ADR-005; `hero.jpg` full-res arka plan, 12 adet 1600×1200 galeri
görseli, hash'ler `assets-manifest.json` ile kilitli). Bu sprintte yeniden
encode/derivative üretimi kapsam dışıdır. TBT 0 ms — JS tarafı temiz; maliyet
tamamen görsel byte ağırlığı.

Parity onayı SONRASI için optimizasyon adayları (ayrı sprint, her biri görsel
regression ile doğrulanarak): responsive `srcset` türevleri (orijinaller
korunarak ayrı dosya), hero için önceden boyutlandırılmış varyant, galeri
thumbnail türevleri, AVIF/WebP alternatifleri.

## Not

- Ölçüm lokal container üzerinde yapıldığından ağ gecikmesi Lighthouse
  simülasyonundan gelir; staging URL'de yeniden ölçüm önerilir.
- Kamera duvarı SEO 90: sayfa bilinçli olarak minimal meta içerir (kaynak
  parity); ek meta eklemek parity kapsamı dışında tutuldu.
