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

## 4. Gerçek entegrasyon öncesi müşteriden istenecekler (özet)

Kamera/NVR marka-model ve fiziksel adet; her kameranın doğru adı/sırası
(ana sayfa–duvar tutarsızlığının çözümü); RTSP/ONVIF, çözünürlük/FPS/codec;
ses olup olmayacağı; kamera ağına erişen sunucu; `kameraizle` DNS yönetimi;
tünel/proxy hesabı ve origin portu; upload kapasitesi ve CGNAT; 7/24 beklentisi;
kayıt; maskeleme gereken alanlar; yayın/mahremiyet bilgilendirmeleri.
**Gizli bilgiler sohbet/issue/git'e yazılmayacak; güvenli secret handoff kullanılacak.**

## 5. Yapılmayacaklar (bu sprintlerde)

Gerçek kamera onarımı, `kameraizle` üzerinde servis açma/değiştirme, DNS
değişikliği, production deploy, credential'ların istemciye gömülmesi.
