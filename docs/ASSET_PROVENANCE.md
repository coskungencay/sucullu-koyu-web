# ASSET_PROVENANCE — Medya Varlığı Kaynak Kaydı

**Snapshot tarihi:** 23 Temmuz 2026
**Kaynak:** `https://sucullukoyu.com/gorseller/`
**Manifest:** `assets-manifest.json` (SHA-256 dahil) — doğrulama: `npm run verify:assets`

## Kullanım yetkisi notu

Bu çalışma, site sahibi/işletmecisinin kaybolan kaynak kodun yeniden oluşturulması
talebi kapsamındadır (CTO paketi §2). Alan adı, içerik, fotoğraflar, tanıtım
videosu ve marka üzerindeki kullanım/yayın yetkisinin müşteride olduğu; kamera
görüntülerinin yayın yetkisi ve mahremiyet sorumluluğunun müşteriye ait olduğu
proje kaydı olarak buraya işlenmiştir. Bu not hukuk görüşü değildir.

## Snapshot prosedürü (uygulandı)

1. Yalnızca kaynak HTML/CSS içinde doğrulanmış first-party URL'ler indirildi.
2. Dosya adları birebir korundu; **hiçbir dosya yeniden encode edilmedi/sıkıştırılmadı**.
3. Her dosya için kaynak URL, local path, MIME, byte, boyut/video metadata ve SHA-256 `assets-manifest.json` içinde kayıt altına alındı.
4. İndirilemeyen dosya: **yok** (56/56 başarılı, BLOCKED yok).

## Envanter özeti

| Grup | Adet | Not |
|---|---:|---|
| `hero.jpg` | 1 | 768×486 — hero arka planı + video posteri + OG görseli |
| `sucullu-koyu-giris.jpg` | 1 | Hoş Geldiniz bölümü |
| `gorsel-01.jpg … gorsel-53.jpg` | 53 | Galeri; `gorsel-03` ve `gorsel-15` Hakkımızda'da yeniden kullanılıyor |
| `tanitim-video.mp4` | 1 | 848×480, h264, 60,650522 s — ffprobe ile doğrulandı |
| **Toplam** | **56** | 27.246.792 B |

## Fontlar ve ikonlar (pinlendi + self-host)

| Bağımlılık | Sürüm/weight | Konum |
|---|---|---|
| Inter | 300/400/500/600/700, latin+latin-ext+… (47 face, main toplamı) | `public/fonts/inter/` |
| Playfair Display | 400/600/700 | `public/fonts/playfair-display/` |
| Rajdhani | 400/600/700 | `public/fonts/rajdhani/` |
| Share Tech Mono | 400 | `public/fonts/share-tech-mono/` |
| Font Awesome Free | **6.5.1** (css + 8 webfont) | `public/vendor/fontawesome/` |
| hls.js | **1.4.12** (npm, pin) | `package.json` — Sprint 3'te kullanılacak |

Google Fonts CSS'leri woff2 URL'leri yerel yollara yeniden yazılarak
`public/fonts/fonts-main.css` ve `public/fonts/fonts-camera.css` olarak sabitlendi.
Kaynak weight setleri değiştirilmedi. Türkçe karakterler için latin-ext dahil
tüm subset'ler indirildi (57 woff2).

## Bütünlük

`npm run verify:assets` → 56/56 dosya SHA-256 eşleşmesi (son çalıştırma: 23.07.2026, OK).
Optimize türev üretilecekse ayrı dosya olarak eklenecek; orijinaller değişmez.
