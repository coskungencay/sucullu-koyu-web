# CAMERA_DEPLOYMENT_RUNBOOK — Kamera Sistemi İşletme Kılavuzu

Mimari:

```
Reolink NVS36 (192.168.1.113, RTSP substream)
  → Köy Windows PC: FFmpeg relay ×9 (tools/windows-camera-relay)
  → İnternet: şifreli SRT (UDP 8890, passphrase)
  → Coolify: MediaMTX 1.20.0 (deploy/camera-gateway)
  → HTTPS HLS: https://sucullu-koyu-camera.46.225.123.167.sslip.io/{path}/index.m3u8
  → Site (hls.js player): VITE_CAMERA_BASE_URL
```

Kanal eşlemesi (kesin sözleşme; unit test ile kilitli):

| HLS path | NVR kaynağı | | HLS path | NVR kaynağı |
|---|---|---|---|---|
| kamera1 | Preview_01_sub | | kamera8 | Preview_08_sub |
| kamera2 | Preview_02_sub | | kamera11 | Preview_11_sub |
| kamera6 | Preview_04_sub | | kamera10 | Preview_10_sub |
| kamera5 | Preview_05_sub | | p850 | Preview_12_sub |
| kamera7 | Preview_07_sub | | | |

## 1. Coolify gateway deploy

Uygulama: **camera-gateway** (proje: sucullu-koyu) — GitHub repo main branch,
build pack: Docker Compose, compose dosyası `/deploy/camera-gateway/docker-compose.yml`.

Environment (Coolify secret deposunda; repoda YOK):

| Değişken | Değer |
|---|---|
| `MTX_PATHDEFAULTS_SRTPUBLISHPASSPHRASE` | güçlü rastgele (10–79 kr); relay'deki `SRT_PASSPHRASE` ile aynı |
| `MTX_HLSALLOWORIGIN` | `https://sucullu-koyu-web.46.225.123.167.sslip.io` |

Domain: `https://sucullu-koyu-camera.46.225.123.167.sslip.io` → mediamtx:8888.
UDP 8890 host mapping compose'tadır (Coolify proxy UDP taşımaz).

Doğrulama (relay yokken): container running; `GET /kamera1/index.m3u8` → 404
(yayın yok — normal); rastgele path'e SRT publish reddedilir; yanlış
passphrase reddedilir.

## 2. DNS

Şu an DNS kaydı GEREKMEZ (sslip.io IP'den çözülür). `sucullukoyu.net`
geçişinde: `kamera.sucullukoyu.net A 46.225.123.167` kaydı eklenir, Coolify'da
gateway domaini değiştirilir (TLS otomatik), aşağıdaki §6 domain adımları uygulanır.

## 3. Windows kurulumu (köy bilgisayarı — tek seferlik)

1. `dist-tools/sucullu-kamera-relay.zip` → PC'ye kopyala, `C:\SucculluKameraRelay` içine aç.
2. `config.env.example` → `config.env` kopyala; `NVR_USER`, `NVR_PASSWORD`,
   `SRT_PASSPHRASE` doldur (passphrase = Coolify'daki değer; SRT_HOST hazır yazılı).
3. `install.cmd` → sağ tık → **Yönetici olarak çalıştır**.

Kurulum FFmpeg 7.1.1'i indirir (SHA-256 doğrulamalı), 9 relay'i başlatır ve
açılışta otomatik başlatma görevi kurar (oturum açılmasa da SYSTEM olarak çalışır).

Günlük işletme: `status.cmd` / `stop.cmd` / `start.cmd`; loglar `logs\<kamera>.log`
(5 MB rotasyon ×3). Ayrıntı: `tools/windows-camera-relay/README.md`.

## 4. Siteyi canlıya alma (relay çalışırken!)

Relay bağlanıp 9/9 manifest 200 dönmeden siteyi live moda ALMAYIN
(kartlar offline döngüsüne girer; zarar vermez ama gereksizdir).

1. Doğrula: `curl -sI https://sucullu-koyu-camera.46.225.123.167.sslip.io/kamera1/index.m3u8` → 200.
2. Coolify → **sucullu-koyu-web** uygulaması → Environment:
   `VITE_CAMERA_BASE_URL=https://sucullu-koyu-camera.46.225.123.167.sslip.io`
   (**Build Variable** olarak işaretle — Vite build-time değişkenidir).
3. Redeploy. Site kartları ve kamera duvarı otomatik live moda geçer
   (frontend'de kod değişikliği yok; mode çözümü env'den).

Geri almak için: değişkeni silin + redeploy → site anında güvenli disabled moda döner.

## 5. Kamera ekleme/değiştirme

1. NVR kanalı belirle → `tools/windows-camera-relay/relay.ps1` `CameraMap`'e ekle/düzenle.
2. `deploy/camera-gateway/mediamtx.yml` `paths:` listesine path ekle.
3. Frontend `src/camera/camera-current-map.json`'a kamera kaydı ekle
   (homeOrder/wallOrder/etiketler).
4. Unit testler sözleşmeyi doğrular (`camera-gateway-config.test.ts` +
   `camera-config.test.ts` sayı/sıra beklentilerini güncelle).
5. Gateway redeploy + site redeploy + relay'de `stop.cmd`→ZIP güncelle→`start.cmd`.

## 6. Credential rotation

- **NVR parolası:** NVR'da değiştir → köy PC `config.env` güncelle →
  `stop.cmd` + `start.cmd`. Başka hiçbir yerde yok.
- **SRT passphrase:** Coolify'da `MTX_PATHDEFAULTS_SRTPUBLISHPASSPHRASE`
  güncelle + gateway redeploy → köy PC `config.env` `SRT_PASSPHRASE` güncelle
  + restart. (Kısa kesinti olur; sıra önemli değil, ikisi eşleşince bağlanır.)
- **Coolify API token:** yalnızca yönetim işlemleri içindir; runtime'da
  kullanılmaz. Panelden rotate edilebilir.

## 7. Sorun giderme

| Belirti | Kontrol |
|---|---|
| Manifest 404 (tümü) | Relay çalışıyor mu? (`status.cmd`); SRT_HOST/passphrase eşleşiyor mu; UDP 8890 çıkışı ISP/modem engeli |
| Manifest 404 (tek kamera) | O kameranın logu; NVR'da kanal aktif mi |
| Sitede "Bağlantı Yok" ama manifest 200 | Tarayıcı konsolunda CORS hatası → `MTX_HLSALLOWORIGIN` site origin'i ile birebir mi |
| Görüntü donuk/kopuyor | Köy upload bant genişliği (9×substream ≈ 4–7 Mbps); `latency=2000` artırılabilir |
| Gateway restart sonrası | Relay'ler otomatik yeniden bağlanır (bounded backoff, ≤5 dk) |
| Windows restart sonrası | Görev ONSTART tetiklenir; `status.cmd` ile doğrula |
| Yüksek CPU (köy PC) | Logda "codec: hevc" olan kamera sayısına bak; NVR'da substream'i H.264'e çevir |

## 8. Geri alma

- **Site:** `VITE_CAMERA_BASE_URL` sil + redeploy → disabled mod (site sağlığı
  kamera altyapısından bağımsız).
- **Gateway:** Coolify'da önceki deployment'a rollback veya uygulamayı durdur
  (site etkilenmez).
- **Relay:** `uninstall.cmd` → NVR'a hiçbir kalıcı değişiklik yapılmamıştır.

## 9. Domain geçişi (sucullukoyu.net — ileride)

Yalnızca şu değerler değişir; mimari değişmez:

1. DNS: `sucullukoyu.net` + `kamera.sucullukoyu.net` A → 46.225.123.167.
2. Coolify site domaini → `https://sucullukoyu.net`; gateway domaini →
   `https://kamera.sucullukoyu.net`.
3. Gateway env `MTX_HLSALLOWORIGIN=https://sucullukoyu.net` + redeploy.
4. Site env `VITE_CAMERA_BASE_URL=https://kamera.sucullukoyu.net` + redeploy.
5. Köy PC `config.env` `SRT_HOST=kamera.sucullukoyu.net` + restart (opsiyonel;
   IP de çalışmaya devam eder).
