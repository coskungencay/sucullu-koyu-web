# CAMERA_HANDOFF — Kamera Sistemi Mevcut Durum ve Devir Notları

**Denetim tarihi:** 23 Temmuz 2026

## 1. Mevcut durum (yalnızca belgelendi — onarım denenmedi)

| Katman | Durum |
|---|---|
| `www.sucullukoyu.com` | ✅ Çalışıyor (200) |
| Ana sayfa HLS istemcisi (hls.js 1.4.12) | ✅ Yükleniyor, oynatıcılar kuruluyor |
| Kamera duvarı istemcisi (`hls.js@latest`) | ✅ Yükleniyor |
| `kameraizle.sucullukoyu.com` DNS | ❌ **NXDOMAIN** (bu denetimde hiç çözümlenmiyor) |
| HLS origin | ❌ Erişilemez |

CTO paketi aynı gün için `…/kamera1/index.m3u8` → **502 Bad Gateway,
[Errno 111] Connection refused** kaydetmişti (ağ geçidi yanıt veriyor, origin
reddediyor). Bu denetimde durum NXDOMAIN'e gerilemiş: ağ geçidine artık DNS
düzeyinde bile ulaşılamıyor. İki bulgu birlikte şunu gösterir: arıza
HTML/CSS'te değil; DNS kaydı + tünel/gateway + origin HLS servisi zincirinde.

Muhtemel arıza alanları (CTO §1 ile uyumlu, teyit gerektirir): silinen/expire
DNS kaydı, durmuş tünel ajanı (ör. cloudflared vb.), kapalı yayın sunucusu,
yanlış origin portu/proxy hedefi, firewall, RTSP→HLS çevirici servisinin durması.

## 2. Clone'daki kamera davranış sözleşmesi (Sprint 3 ile tamamlandı)

- Base URL **yalnızca** `VITE_CAMERA_BASE_URL` env değişkeninden gelir (`.env.example`).
- Env boşsa (mevcut durum): **hiçbir ağ isteği yapılmaz**; ana sayfa kartları
  kaynakla aynı loading görünümünde, duvar hücreleri kaynağın doğrulanmış
  offline görünümünde (BAĞLANIYOR... + BAĞLANTI YOK + 0/9 AKTİF) bekler.
  E2E testi `kameraizle`/`m3u8` isteği olmadığını doğrular.
- Adlandırma/sıralama tek kaynağı: `src/camera/camera-current-map.json`
  (CTO paketinden). Ana sayfa ↔ duvar etiket/sıra farkı bilinçli korunuyor.
- URL kalıbı: `{PUBLIC_CAMERA_BASE_URL}/{streamPath}/index.m3u8` —
  `buildManifestUrl()` base yokken `null` döner.
- hls.js **1.4.12** npm'de pinli; `@latest` kullanılmıyor.
- Frontend'e RTSP adresi, kullanıcı adı/parola, kamera IP'si konmadı ve konmayacak.

## 3. Kaynaktaki kopyalanmayan teknik kusurlar (CTO §7.3) — GİDERİLDİ

Sprint 3'te state-machine tabanlı player yazıldı (görsel sonuç birebir):
timer leak yok (tek retry + tek stall timer, tam cleanup), aktif sayaç state
set'inden türetiliyor, backoff+jitter ile sınırlı hızlı retry sonrası offline,
ana sayfada IntersectionObserver ile görünürlüğe bağlı init, endpoint yalnızca
env/config. hls.js 1.4.12 yalnızca live modda dynamic import edilir.
Mimari: `docs/CAMERA_PLAYER_ARCHITECTURE.md`. Deterministik test modları:
`?cam=mock-loading | mock-offline | mock-live[&live=0..9]`.

## 4. Saha teslim runbook'u (Sprint 4)

### 4.1 Müşteriden toplanacak bilgi formu

| Alan | Örnek/format | Not |
|---|---|---|
| Kamera/NVR marka-model | ör. Hikvision DS-xxxx / Dahua NVR | model başına RTSP şablonu değişir |
| Fiziksel kamera sayısı ve adları | "Köy meydanı", "Okul önü"… | ana sayfa–duvar etiket tutarsızlığının çözüm kararı burada verilecek |
| RTSP/ONVIF desteği | RTSP URL şablonu, ONVIF portu | credential HARİÇ, şablon olarak |
| Codec / çözünürlük / FPS | H.264 1080p@15 vb. | H.265 ise transcode gerekir |
| Ses | var/yok + yayınlanacak mı | mahremiyet etkisi var |
| Kamera ağına erişen cihaz | mevcut sunucu/PC/NVR | gateway bu makinede koşacak |
| İnternet upload kapasitesi | Mbps | 9 yayın için ~2-4 Mbps/kamera |
| CGNAT durumu | var/yok | varsa tünel (ör. cloudflared) zorunlu |
| `kameraizle` DNS yönetimi | registrar/panel erişimi kimde | şu an NXDOMAIN — kayıt yeniden oluşturulacak |
| Tünel/proxy hesabı | mevcutsa sağlayıcı + hesap sahibi | eski kurulumun envanteri |
| Origin servis portu | ör. 8888 | gateway → reverse proxy hedefi |
| 7/24 beklentisi | evet/hayır | watchdog/restart politikası |
| Kayıt | canlı-yalnız / kayıtlı | depolama planı |
| Maskeleme gereken alanlar | özel mülk/pencere vb. | yayın öncesi zorunlu kontrol |
| Yayın/mahremiyet bilgilendirmesi | tabela/duyuru durumu | müşteri sorumluluğu, kayda geçirilecek |

### 4.2 Teknik kurulum sırası (erişim geldikten sonra)

1. Gateway makinesinde kamera RTSP erişim testi (LAN içi).
2. RTSP→HLS gateway kurulumu (ör. MediaMTX/ffmpeg tabanlı; credential
   YALNIZCA gateway config'inde, dosya izinleri 600).
3. Origin health: `curl -f http://127.0.0.1:<port>/kamera1/index.m3u8`.
4. Tünel/reverse proxy: `kameraizle.sucullukoyu.com` → origin; DNS kaydının
   yeniden oluşturulması (şu an NXDOMAIN).
5. **TLS:** geçerli sertifika zorunlu (Let's Encrypt/tünel sağlayıcısı);
   clone yalnızca HTTPS base URL kabul eder.
6. **CORS:** `Access-Control-Allow-Origin` site origin'i ile sınırlandırılmalı
   (wildcard önerilmez); `GET, HEAD` yeterli.
7. Dış health kontrolü: `curl -f https://kameraizle.sucullukoyu.com/kamera1/index.m3u8`
   (200 + geçerli m3u8 içeriği).
8. Staging'de `VITE_CAMERA_BASE_URL=https://kameraizle.sucullukoyu.com` ile
   deploy; 9 kameranın `mock` yerine `live` modda doğrulanması.
9. 24 saat gözlem: reconnect sayıları, stall oranı, bant genişliği.

### 4.3 Credential saklama kuralları

- RTSP kullanıcı adı/parola, kamera IP'si, yönetim portu: YALNIZCA gateway
  sunucusunda. Git/issue/sohbet/frontend'e asla girmez (bu repo'daki URL
  doğrulayıcı credential'lı URL'leri zaten reddeder).
- Secret aktarımı için tek kullanımlık güvenli kanal (ör. parola yöneticisi
  paylaşımı); e-posta/mesajla düz metin gönderilmez.

### 4.4 Canlıya alma checklist'i

- [ ] Kamera adları/sırası müşteriyle netleşti; `camera-current-map.json` güncellendi
- [ ] Tüm 9 manifest HTTPS'te 200 + oynatılabilir
- [ ] CORS yalnızca site origin'ine açık
- [ ] TLS sertifikası geçerli, otomatik yenileme kurulu
- [ ] CSP `connect-src/media-src` origin'i doğru
- [ ] Ses kararı uygulandı (yayında ses varsa varsayılan muted korunur)
- [ ] Maskeleme/mahremiyet kontrolleri tamam, bilgilendirme yapıldı
- [ ] Staging'de E2E + görsel doğrulama geçti
- [ ] 7/24 izleme/watchdog aktif
- [ ] Rollback: `VITE_CAMERA_BASE_URL` boşaltılırsa site anında güvenli
      disabled moda döner (yeniden deploy yeterli); gateway sorunları site
      erişilebilirliğini ETKİLEMEZ

### 4.5 Rollback

Kamera katmanı ile site katmanı ayrıktır: gateway/DNS arızasında yalnızca
kamera kartları offline görünür, site çalışmaya devam eder. Kamera canlı
yayınını geri çekmek için env'den base URL kaldırılıp yeniden deploy edilir.
Coolify'da önceki başarılı deployment'a rollback her zaman mümkündür.

## 5. Yapılmayacaklar (değişmedi)

Gerçek kamera onarımı, `kameraizle` üzerinde servis açma/değiştirme, DNS
değişikliği ve production domain cutover AYRI ONAY gerektirir;
credential'ların istemciye gömülmesi her koşulda yasaktır.
