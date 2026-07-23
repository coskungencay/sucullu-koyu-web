# SOURCE_AUDIT — Kaynak Site Denetimi

**İnceleme tarihi:** 23 Temmuz 2026 (Europe/Istanbul)
**İnceleyen:** Claude Code — Senior Developer
**Yöntem:** curl ile ham HTML/CSS/JS indirme + Playwright (Chromium) ile canlı render incelemesi
**Kaynak snapshot:** `reference/source-html/` (index.html, canli-kamera.html, css/style.css, js/main.js)

## 1. Doğrulanan rotalar

| Rota | HTTP | Boyut | Not |
|---|---|---|---|
| `https://www.sucullukoyu.com/` | 200 | 49.583 B | Tek sayfa tanıtım sitesi |
| `https://sucullukoyu.com/canli-kamera.html` | 200 | 15.880 B | 3×3 kamera duvarı |

## 2. Teknik profil (canlıdan doğrulandı)

- Statik HTML/CSS/JS; ana CSS `css/style.css?v=20260602` (26.307 B), ana JS `js/main.js` (7.410 B).
- Fontlar: Google Fonts — Inter 300–700, Playfair Display 400/600/700 (ana); Rajdhani 400/600/700, Share Tech Mono (duvar). Türkçe glifler `latin-ext` subset'inde.
- İkonlar: Font Awesome Free 6.5.1 (cdnjs).
- Ana sayfa HLS istemcisi: hls.js **1.4.12** (cdnjs); kamera duvarı: `hls.js@latest` (jsdelivr, sabitlenmemiş) — CTO paketiyle uyumlu.
- Favicon: data URI içinde 🏘️ emoji SVG.
- Harita: Google Maps embed iframe (450 px, mobil 350 px).
- Meta/SEO: title `Sücüllü Köyü | Yalvaç / Isparta`; description, keywords, OG/Twitter etiketleri CTO paketindeki değerlerle birebir doğrulandı.

## 3. Bölüm envanteri (kaynak sırası — değiştirilemez)

1. Navbar (fixed, scroll'da beyaz/blur)
2. Hero `#anasayfa` — hero.jpg, 3 tonlu gradient overlay, sıralı fadeUp (0.3/0.6/0.8/1.0 s), bounce ok
3. Stats `#stats` — Nüfus 1502, Mahalle 6, Rakım 1096 m, Kuruluş 1478 (tr-TR biçimi: "1.502", "1.096 m", "1.478")
4. Hoş Geldiniz `#hosgeldiniz` — sucullu-koyu-giris.jpg, altın dekoratif border, "Gılallar Ekrem Bilgiç" notu
5. Hakkımızda `#hakkimizda` — gorsel-15.jpg (ana, 400 px) + gorsel-03.jpg (200×200 float), 4 feature
6. Tarihçe `#tarihce` — 6 timeline maddesi (Tunç Çağı → Günümüz)
7. Mahalleler `#mahalleler` — 6 kart
8. Galeri `#galeri` — 53 görsel; JS ile ilk 12 görünür, 13–53 `.hidden`; lightbox
9. Video `#video` — tanitim-video.mp4 (848×480, 60,650522 s, h264), poster hero.jpg, native controls
10. Ekonomi `#ekonomi` — Tarım (10 chip) + Hayvancılık (5 chip)
11. Canlı Kamera `#canli-kamera` — 9 kart, inline `<style>` + inline script, `BASE` hardcoded
12. Konum `#konum` — 3 bilgi kutusu + Maps iframe
13. Footer `#iletisim` — 4 kolon; Muhtar: Ömer Özcanlı; © 2025

Nav linkleri (7): Ana Sayfa, Hakkımızda, Tarihçe, Galeri, Canlı Kamera, Konum, İletişim.

## 4. Kamera sistemi mevcut durum — GÜNCEL BULGU

CTO paketi (23.07.2026) `https://kameraizle.sucullukoyu.com/kamera1/index.m3u8` için
**502 Bad Gateway / [Errno 111] Connection refused** raporlamıştı.

**Bu denetimde (23.07.2026, bu makinenin çözümleyicisiyle) durum daha da ileri:**

```
$ dig kameraizle.sucullukoyu.com
status: NXDOMAIN, ANSWER: 0
```

Alt alan adı DNS düzeyinde hiç çözümlenmiyor. `www.sucullukoyu.com` (195.35.58.166)
normal çözümleniyor. Yani ağ geçidine ulaşılamama sorunu 502'den NXDOMAIN'e
gerilemiş durumda (DNS kaydı silinmiş/expire olmuş olabilir veya resolver'a göre
farklılık gösteriyor olabilir). Her iki durumda da sonuç aynı: **hiçbir kamera
yayını erişilebilir değil.** Onarım bu sprintlerin kapsamı dışındadır; ayrıntı
`docs/CAMERA_HANDOFF.md` içinde.

Not: Playwright ile canlı ana sayfa gezintisinde console'a error düşmüyor;
HLS.js ağ hatalarını kendi içinde yönetiyor ve kartlar loading/offline
döngüsünde kalıyor.

## 5. Ana sayfa ↔ kamera duvarı doğrulanmış tutarsızlıklar (bilinçli korunuyor)

- Ana sayfa etiketleri: KAMERA 01, 02, 04, 05, 07, 08, 11, 10, P850 (stream sırası: kamera1, 2, 6, 5, 7, 8, 11, 10, p850)
- Duvar etiketleri: KAMERA 01–09 ardışık (stream sırası: kamera1, 2, 6, 5, 7, 8, **10, 11**, p850)
- 7. ve 8. öğelerin sırası iki yüzeyde ters; etiket şemaları farklı.
- `camera-current-map.json` bu farkı `homeOrder/homeLabel` ve `wallOrder/wallLabel` ile modelliyor; clone aynen koruyor.

## 6. CTO paketi ile canlı site arasında tespit edilen farklar

| Konu | CTO paketi | Canlı bulgu |
|---|---|---|
| Kamera endpoint durumu | 502 Bad Gateway | NXDOMAIN (bkz. §4) |
| Diğer tüm iddialar | — | Birebir doğrulandı; sapma yok |

## 7. Clone'da bilinçli yapılan (görünmez) teknik sapmalar

Görsel/işlevsel çıktıyı değiştirmeyen, CTO şartnamesinin zorunlu kıldığı sapmalar:

1. Google Fonts + Font Awesome self-host (CDN yerine `/fonts`, `/vendor/fontawesome`).
2. Kamera inline script'i kaldırıldı; endpoint hardcode edilmeden config/env tabanlı modüle taşındı (`src/camera/`).
3. `hls.js@latest` yerine npm `hls.js@1.4.12` pinlendi (Sprint 3'te kullanılacak).
4. Kamera duvarındaki bottombar butonlarının artık var olmayan global fonksiyonlara işaret eden `onclick` öznitelikleri kaldırıldı (davranışlar Sprint 3'te bağlanacak).
5. `js/main.js` TypeScript modüllerine birebir port edildi; galeri genişletme + lightbox bağlama Sprint 2'ye bırakıldı.
