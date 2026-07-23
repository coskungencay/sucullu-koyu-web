# CLIENT_ACCEPTANCE — Müşteri Onay Paketi

**Proje:** www.sucullukoyu.com birebir yeniden yapımı (kaybolan kaynak kod)
**Durum:** Sprint 0–4 tamamlandı; staging deploy bekleniyor · **Tarih:** 23 Temmuz 2026

## 1. Kapsam

Kaynak sitenin iki kullanıcı yüzeyi görünüm, içerik, medya, animasyon ve
responsive davranış düzeyinde yeniden üretildi:

- `/` — 13 bölüm: Navbar, Hero, İstatistikler (1502/6/1096 m/1478), Hoş
  Geldiniz, Hakkımızda, Tarihçe (6 madde), Mahalleler (6 kart), Galeri
  (53 fotoğraf; ilk 12 + "Tüm Fotoğrafları Göster" + lightbox), Tanıtım
  Videosu (848×480, 60,65 sn, orijinal dosya), Ekonomi ve Yaşam, Canlı Kamera
  (9 kart), Konum + Google Maps, Footer/İletişim.
- `/canli-kamera.html` — 3×3 kamera duvarı: büyütme, ses/yenile/tam ekran,
  klavye kontrolleri, canlı saat.
- **56 medya dosyası** orijinal byte'larıyla korunuyor (SHA-256 kilitli).

## 2. Bilinen kamera altyapı blocker'ı

Kamera görüntüleri şu anda HİÇBİR yerde yayınlanamıyor: `kameraizle.
sucullukoyu.com` DNS kaydı çözümlenmiyor (NXDOMAIN; site kodundan bağımsız,
mevcut canlı sitede de aynı durum). Clone, kamera arayüzünü birebir taşır ve
altyapı onarıldığında tek ayarla canlı yayına hazırdır. Onarım için gereken
bilgiler: `docs/CAMERA_HANDOFF.md`.

## 3. Doğrulama sonuçları

- **Görsel eşleşme (kaynak ↔ clone, 6 viewport):** 22/22 bölüm ekran
  görüntüsü %0.000 fark; galeri/lightbox/menü etkileşim görüntüleri %0.000;
  kamera duvarı 4 viewport + büyütme + kontroller %0.000. Ayrıntı:
  `docs/VISUAL_PARITY.md`.
- **Testler:** 94 unit + 53 E2E senaryo — tamamı geçiyor. Console hatası 0,
  kırık dosya 0.
- **Lighthouse:** Erişilebilirlik 91–97, Best Practices 96–100, SEO 90–100
  (hedef ≥90 sağlandı). Mobil performans 61 — orijinal fotoğraf/video
  dosyaları birebir korunduğu için; onayınız sonrası ayrı bir optimizasyon
  adımı önerilir (`docs/LIGHTHOUSE.md`).

## 4. Deployment durumu

- Staging URL: **deploy sonrası eklenecek** (HTTPS, Coolify staging domaini).
- **`www.sucullukoyu.com` production domaini DEĞİŞTİRİLMEDİ**; mevcut canlı
  site olduğu gibi çalışıyor. Cutover ayrı onayınıza tabidir.

## 5. Onayınız gereken konular

1. Staging görünümünün mevcut siteyle birebirliği (gezerek kontrol).
2. Footer bilgileri güncel mi: **Muhtar: Ömer Özcanlı** · **© 2025**.
3. Kamera adları/sırası: ana sayfa ile kamera duvarı etiketleri mevcut sitede
   birbirinden farklı (belgeli tutarsızlık — birebir korundu). Gerçek
   entegrasyonda hangi adlandırma esas alınacak?
4. Fotoğrafların, tanıtım videosunun ve marka/metinlerin kullanım-yayın
   yetkisinin tarafınızda olduğunun teyidi (`docs/ASSET_PROVENANCE.md`).
5. Kamera yayını mahremiyet sorumluluğu ve bilgilendirme yükümlülüğü.
6. Production cutover zamanlaması ve `docs/CAMERA_HANDOFF.md` bilgi formu.
