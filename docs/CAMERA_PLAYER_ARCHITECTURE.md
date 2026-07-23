# CAMERA_PLAYER_ARCHITECTURE — Kamera Player Mimarisi (Sprint 3)

Gerçek kamera entegrasyonu YAPILMADI; bu mimari, yayın bilgileri geldiğinde
`VITE_CAMERA_BASE_URL` tanımlanarak güvenle devreye alınacak temeldir.

## Modüller

| Modül | Sorumluluk |
|---|---|
| `camera-mode.ts` | Merkezi mod çözümleme (disabled/mock-*/live) |
| `camera-url.ts` | Base URL doğrulama + manifest URL üretimi (güvenlik) |
| `camera-state.ts` | Saf state machine (`transition`) |
| `camera-driver.ts` | `CameraStreamDriver` temel sınıfı + `FakeCameraDriver` |
| `hls-driver.ts` | `HlsCameraDriver` (hls.js 1.4.12, dynamic import) |
| `camera-player.ts` | Kamera başına lifecycle: retry, stall, cleanup |
| `camera-manager.ts` | Koleksiyon: aktif sayı türetme, global mute, refresh |
| `camera-preview.ts` | Ana sayfa 9 kart + IntersectionObserver init |
| `camera-wall.ts` | Duvar: grid, büyütme, ses/yenile/tam ekran, klavye, alt bar, saat |

## Kamera modları

```
disabled | mock-loading | mock-offline | mock-live | live
```

- **Varsayılan `disabled`**: `VITE_CAMERA_BASE_URL` boş/geçersizse. Hiçbir
  player oluşturulmaz, sıfır ağ isteği. Production build'in varsayılanı budur.
- **`live`**: yalnızca geçerli HTTPS base URL ile. **Query ile live moda
  geçilemez** — `?cam=live` bilinmeyen değer sayılır ve disabled'a düşer.
- **Mock modları** (`?cam=mock-loading|mock-offline|mock-live[&live=0..9]`):
  yalnızca whitelist değerler; `FakeCameraDriver` ile sıfır ağ isteği;
  Playwright/visual testler için deterministiktir. `live=N` ilk N kamerayı
  (render sırasına göre) canlı yapar; geçersiz değer 9 sayılır.
- Bilinmeyen `cam` değeri → disabled.
- Mock modlarda retry politikası `fastAttempts: 0`'dır: ilk hata anında
  `offline(retry-exhausted)` — determinism için. Gerçek backoff yalnızca live
  modda ve player unit testlerinde işler.

## State machine

```
idle → loading → playing → stalled → retry-wait → loading
loading → retry-wait | offline
retry-wait → offline
herhangi bir state → destroyed  (terminal)
```

`transition(state, event, policy)` saf fonksiyondur; geçersiz geçiş state'i
değiştirmez, `destroyed`'dan çıkış yoktur. Offline reason seti:
`disabled, missing-base-url, invalid-base-url, manifest-error, network-error,
media-error, retry-exhausted, unsupported, destroyed`. UI'da teknik reason
gösterilmez; kaynak "Bağlantı Yok" metni korunur.

## Driver arayüzü

```ts
interface CameraStreamDriver {
  attach(video, url): Promise<void>;
  start(): void; stop(): void; destroy(): void;
  on(event: 'playing' | 'error', handler): Unsubscribe;
}
```

- `HlsCameraDriver`: hls.js **1.4.12** (npm pin, `@latest` yok) `attach()`
  içinde dynamic import edilir → disabled/mock modlarda kütüphane hiç yüklenmez.
  HLS config kaynak ana sayfa istemcisinin doğrulanmış değerleridir. Destroy:
  hls.destroy + video listener temizliği + `src` kaldırma + `load()`.
- `FakeCameraDriver`: `live | offline | loading` senaryoları; DI scheduler ile
  deterministik; `emitForTest` unit testlerde keyfî event dizisi sürer.
- Destroy idempotenttir; destroy sonrası hiçbir event yayınlanmaz.

## Lifecycle garantileri (kaynak kusurlarının düzeltilmesi — CTO §7.3)

- Kamera başına aynı anda TEK driver/HLS instance; reconnect öncesi eskisi
  tamamen destroy edilir (event unsubscribe + media temizliği).
- TEK retry timer; yeni retry planlanınca eskisi temizlenir. Kaynaktaki
  `setInterval` birikmesi (timer leak) yoktur.
- Stall watchdog: `timeupdate` gelmezse 15 sn'de stalled → driver yenilenir;
  tek stall timer, her progress'te sıfırlanır (yalnızca live modda aktif).
- Backoff: `retryDelayMs` (üstel + jitter, DI `random` ile deterministik);
  `fastAttempts` aşılırsa `offline(retry-exhausted)`; jitter yok edilebilir.
- Aktif sayı `players.filter(p => p.state.status === 'playing').length`
  eşdeğeri olarak türetilir; manuel `++/--` yoktur. Duplicate `playing`
  eventi state machine'de no-op'tur → sayaç sapamaz.
- `destroy()` idempotent; destroy sonrası bekleyen callback'ler state
  değiştiremez. `start()` idempotent; çifte init ikinci instance üretmez.
- Zaman kaynakları (`Scheduler`, `now`, `random`) dependency injection ile
  test edilebilir (`tests/unit/helpers/fake-scheduler.ts`).

## URL güvenliği

- Base URL yoksa `null`; yalnızca HTTPS (dev'de yalnızca localhost'a HTTP
  opsiyonu); URL'de username/password reddedilir; base'de query/hash
  reddedilir; stream path `^[a-z0-9_-]{1,64}$` (path traversal reddedilir).
- Kalıp: `{baseUrl}/{streamPath}/index.m3u8`.
- Hata mesajları ham URL/secret içermez. RTSP/credential/IP istemcide yoktur.

## Ortam değişkenleri

| Değişken | Etki |
|---|---|
| `VITE_CAMERA_BASE_URL` | Boş → disabled. Geçerli HTTPS → live. Geçersiz → disabled (invalid-base-url) |

## UI eşlemeleri

Ana sayfa kartı: idle/loading/retry-wait/stalled → spinner; playing → video +
CANLI (opacity 1); offline/destroyed → "Bağlantı Yok". Duvar hücresi:
BAĞLANIYOR / CANLI (yeşil dot) / BAĞLANTI YOK; sayaç `N/9 AKTİF`.

## Bilinen kaynak tutarsızlıkları (bilinçli korunuyor)

- Ana sayfa ↔ duvar etiket/sıra farkı (`camera-current-map.json`).
- Ses butonunun görünür metni durum/aksiyon açısından terstir (muted iken
  "🔇 SES KAPAT" görünür; tıklama sesi AÇAR). Görünür metin kaynakla birebir
  korunur; `aria-label` gerçek aksiyonu söyler ("Sesi aç"/"Sesi kapat").
- Duvarda mobil responsive grid yoktur; kaynak 3×3 tam ekran davranışı
  390/360'ta da birebir korunur (ayrı enhancement, clone kabulü sonrası).
