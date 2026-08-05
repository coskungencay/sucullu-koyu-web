# Sücüllü Köyü Kamera Relay (Windows)

Köy bilgisayarındaki bu paket, Reolink NVR'daki 9 kameranın substream'ini alır
ve internet üzerinden **şifreli SRT** ile sunucudaki MediaMTX'e gönderir.
Site bu yayınları HTTPS HLS olarak oynatır.

## Tek seferlik kurulum (3 adım)

1. ZIP'i `C:\SucculluKameraRelay` gibi bir klasöre açın.
2. `config.env.example` dosyasını **`config.env`** adıyla kopyalayın ve içindeki
   `NVR_USER`, `NVR_PASSWORD`, `SRT_PASSPHRASE` alanlarını doldurun
   (`SRT_HOST` sunucu adresi olarak önceden yazılıdır).
3. **Önce `preflight.cmd` çalıştırın** (çift tık; yönetici gerekmez).
   Sisteme hiçbir kalıcı değişiklik yapmaz: ayarları, NVR erişimini ve
   sunucu bağlantısını kontrol eder, kamera1 ile ~20 saniyelik test yayını
   yapıp kapatır. Sonuç **PRE-FLIGHT PASS** olmalıdır.
4. PASS aldıysanız `install.cmd` dosyasına **sağ tıklayıp "Yönetici olarak
   çalıştır"** deyin. (FAIL alırsanız kuruluma geçmeyin; ekrandaki FAIL
   satırlarını düzeltin veya bize gönderin.)

Kurulum; doğrulanmış FFmpeg'i indirir (SHA-256 kontrolü ile), 9 kamera
relay'ini başlatır ve **bilgisayar her açıldığında otomatik başlayacak**
şekilde görev tanımlar (oturum açılması gerekmez).

## Günlük kullanım

| Komut | İşlev |
|---|---|
| `preflight.cmd` | Kurulum öncesi mutasyonsuz kontrol + kısa dry-run |
| `status.cmd` | 9 kameranın anlık durumu + son log satırı |
| `stop.cmd` | Relay'i temiz durdurur |
| `start.cmd` | Relay'i yeniden başlatır |
| `uninstall.cmd` | Otomatik başlatmayı kaldırır (yönetici gerekir) |

Loglar: `logs\kamera1.log` … `logs\p850.log` (5 MB'da döner, 3 kopya saklanır);
preflight çıktısı `logs\preflight.log`. Loglarda parola/passphrase maskelenir.

## Nasıl çalışır

- Her kamera için ayrı FFmpeg süreci ve ayrı log tutulur; bir kameranın
  kesilmesi diğerlerini etkilemez.
- Kesilen yayın artan bekleme ile otomatik yeniden bağlanır (5 sn → en çok
  5 dk); sunucu yeniden başlasa bile relay kendini toparlar.
- Kamera H.264 yayınlıyorsa görüntü DÖNÜŞTÜRÜLMEDEN aktarılır (CPU dostu);
  H.265 ise tarayıcı uyumluluğu için otomatik H.264'e çevrilir.
- NVR kullanıcı adı/parolası yalnızca `config.env` içindedir; loglara
  maskelenerek yazılır, hiçbir yere gönderilmez (NVR'a yerel ağdan bağlanılır).

## Sorun giderme

- `status.cmd` → hepsi KAPALI ve logda "codec tespit edilemedi" →
  `config.env` içindeki NVR kullanıcı/parolasını ve NVR'ın açık olduğunu kontrol edin.
- Logda "Connection refused/timed out" (SRT) → internet bağlantısını ve
  `SRT_HOST`/`SRT_PASSPHRASE` değerlerini kontrol edin.
- Kamera eşlemesi değişecekse: `relay.ps1` içindeki `CameraMap` tablosu
  (yalnızca teknik sorumlu düzenlemeli — site tarafıyla sözleşmelidir).
