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

## Saha durumu (05.08.2026)

Windows relay köy bilgisayarında **kurulu ve çalışıyor**. NVR'de şu anda
**6 fiziksel kanal çevrimiçi**; 3 kanal Reolink uygulamasında da çevrimdışı:

| Durum | Yollar |
|---|---|
| ✅ Aktif (6) | `kamera6` `kamera5` `kamera7` `kamera8` `kamera10` `p850` |
| ⛔ NVR'de kapalı (3) | `kamera1` `kamera2` `kamera11` |

Çevrimdışı kanallar `src/camera/camera-current-map.json` içinde
**`enabled: false`** işaretlidir: bu kameralar için hiçbir yayın isteği
yapılmaz, UI doğrudan kontrollü offline gösterir (görüntü çoğaltılmaz, sahte
"canlı" gösterilmez, gereksiz retry/404 gürültüsü olmaz). Aktif sayaç gerçek
player state'inden türetilir.

**Kanal geri geldiğinde:** ilgili kameranın `enabled` değerini `true` yapıp
siteyi yeniden deploy etmek yeterlidir (relay tarafında değişiklik gerekmez —
9 kanalın hepsi zaten relay'de tanımlı).

Yayın profili (saha doğrulaması): H.264, 896×512, 10 FPS, ~700 kbps,
**video-only** (ses NVR tarafında non-monotonic DTS ürettiği için kapalı).

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
3. **`preflight.cmd`** (yönetici gerekmez) → **PRE-FLIGHT PASS** görülmeli.
   Kontroller: PowerShell 5.1, paket bütünlüğü, `relay.ps1` sözdizimi,
   config alanları (değerler yazılmaz), pinli FFmpeg + SHA-256, FFmpeg'in SRT
   desteği, NVR TCP 554, SRT hedefi DNS/UDP hazırlığı ve kamera1 ile ~20 sn
   foreground dry-run (temiz kapatılır). Sisteme kalıcı değişiklik yapmaz.
4. PASS ise `install.cmd` → sağ tık → **Yönetici olarak çalıştır**.

Kurulum, preflight'ın indirdiği pinli FFmpeg'i kullanır (BtbN autobuild
2026-08-04, SHA-256 sabit; **SRT protokolü bu build'de doğrulandı**), 9 relay'i
başlatır ve açılışta otomatik başlatma görevi kurar (oturum açılmasa da SYSTEM).
CI, `windows-latest` üzerinde sözdizimi, config parser testleri ve
install/uninstall `/dryrun` kontrollerini her push'ta çalıştırır.

Günlük işletme: `status.cmd` / `stop.cmd` / `start.cmd`; loglar `logs\<kamera>.log`
(5 MB rotasyon ×3). Ayrıntı: `tools/windows-camera-relay/README.md`.

## 4. Siteyi canlıya alma (relay çalışırken!)

Relay bağlanıp 9/9 manifest 200 dönmeden siteyi live moda ALMAYIN
(kartlar offline döngüsüne girer; zarar vermez ama gereksizdir).

1. Doğrula: `curl -sI https://sucullu-koyu-camera.46.225.123.167.sslip.io/kamera1/index.m3u8` → 200.
2. Coolify → **sucullu-koyu-web** uygulaması → Environment:
   Gateway adresi **`.env.production`** dosyasındadır (repoda, secret değil).
   Coolify API'si bu sürümde env'i "Build Variable" olarak işaretlemeye izin
   vermediği için (`is_build_time` reddediliyor) tek kaynak bu dosyadır.
3. Redeploy. Site kartları ve kamera duvarı otomatik live moda geçer.

**İki tuzak (yaşandı, testle korunuyor):**
- `.dockerignore` içindeki `.env.*` kuralı dosyayı build context'inden
  çıkarır → `!.env.production` istisnası zorunlu.
- Dockerfile'da **boş varsayılanlı `ENV VITE_*` tanımlamayın**: Vite'ın
  önceliğinde process env dosyayı ezer, site sessizce disabled kalır.

Geri almak için: `.env.production` içindeki değeri boşaltıp redeploy → site
güvenli disabled moda döner.

## 4.5. Relay davranış ayarları (config.env — opsiyonel)

| Ayar | Varsayılan | Anlamı |
|---|---|---|
| `VIDEO_MODE` | `transcode` | `transcode` her zaman H.264'e kodlar (saha varsayılanı: NVR substream'inin DTS'i HLS için bozuk — MediaMTX `unable to extract DTS: too many reordered frames` veriyordu). `copy` yeniden kodlamaz; `auto` kaynak H.264 ise copy seçer. |
| `AUDIO_MODE` | `off` | NVR ses kanalı `Queue input is backward in time` / non-monotonic DTS ürettiği için video-only. `aac` ile ses açılabilir. |
| `PREFLIGHT_CAMERA` | (boş) | Preflight dry-run'ının kullanacağı kamera. Boşsa **ilk erişilebilir kanal** otomatik seçilir — kapalı kanallar atlanır, hiçbir kanal hardcode edilmez. |

Saha kaynaklı diğer teknik kararlar (kodda sabitlendi ve testlerle korunuyor):
FFmpeg RTSP zaman aşımı anahtarı `-timeout` (bu build `-rw_timeout` kabul
etmiyor); girdi tarafında `-fflags +genpts -use_wallclock_as_timestamps 1`;
PowerShell 5.1'de native FFmpeg stderr'inin terminating error olmaması için
çağrılar `Invoke-Native` ile `Continue` scope'una alınır (script'in kalanı
`Stop` güvenliğini korur).

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

## 6.5. UDP 8890 erişimi (kurulum öncesi ZORUNLU kontrol)

SRT ingest UDP'dir; Coolify'ın HTTP proxy'si UDP taşımaz, bu yüzden host port
mapping (`8890:8890/udp`) ve sunucu/bulut firewall'ı açık olmalıdır.
**05.08.2026 doğrulaması: dışarıdan gönderilen SRT handshake'leri MediaMTX'e
ulaşmıyor; container logunda hiç bağlantı denemesi görünmüyor** → UDP yolu
kapalı. Sunucuda (SSH ile) şu kontroller yapılmalı:

```bash
# 1) Port publish edilmiş mi? (0.0.0.0:8890->8890/udp görünmeli)
docker ps --filter name=mediamtx --format '{{.Names}} {{.Ports}}'

# 2) Host firewall
ufw status | grep 8890            # ufw kullanılıyorsa
iptables -L INPUT -n | grep 8890  # ham iptables

# 3) Gerekirse yalnızca bu port için minimal kural
ufw allow 8890/udp comment 'MediaMTX SRT ingest'

# 4) Sunucuda dinleniyor mu
ss -ulnp | grep 8890
```

Ayrıca hosting sağlayıcısının **bulut firewall panelinde** UDP 8890 inbound
izni gerekebilir (host içi kurallardan bağımsızdır).

Doğrulama testi (herhangi bir makineden, SRT destekli ffmpeg ile):

```bash
ffmpeg -re -f lavfi -i testsrc2=size=896x512:rate=10 -c:v libx264 -preset veryfast \
  -g 20 -b:v 400k -pix_fmt yuv420p -an -t 20 -f mpegts \
  "srt://46.225.123.167:8890?mode=caller&latency=2000&pkt_size=1316&passphrase=<PASSPHRASE>&streamid=%23%21%3A%3Am%3Dpublish%2Cr%3Dkamera1"
# Ardından: curl -sI https://sucullu-koyu-camera.46.225.123.167.sslip.io/kamera1/index.m3u8  → 200
```

> SRT streamid sözleşmesi: `#!::m=publish,r=<path>` (URL-encoded). Windows
> relay bunu otomatik üretir.

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
