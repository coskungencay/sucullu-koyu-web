# camera-gateway — MediaMTX (SRT → HLS)

Köydeki Windows relay'den gelen şifreli SRT yayınlarını kabul edip siteye
HTTPS HLS olarak sunar.

```
Reolink NVR (RTSP substream)
  → Windows FFmpeg relay (köy bilgisayarı)
  → şifreli SRT (UDP 8890)
  → MediaMTX (bu paket, Coolify)
  → HTTPS HLS: https://<gateway-domain>/{path}/index.m3u8
  → sitedeki hls.js player
```

## Bileşenler

| Dosya | Amaç |
|---|---|
| `docker-compose.yml` | MediaMTX 1.20.0 (pin), 8890/udp host, 8888 HLS proxy'ye |
| `mediamtx.yml` | Yalnızca SRT+HLS; 9 sabit path; kayıt/diğer protokoller kapalı |
| `.env.example` | Coolify environment şablonu (gerçek secret Coolify'da) |

## Path'ler (değiştirilemez sözleşme)

`kamera1 kamera2 kamera6 kamera5 kamera7 kamera8 kamera11 kamera10 p850`

Catch-all yoktur; bu 9 path dışına yayın kabul edilmez. Frontend URL sözleşmesi:
`{VITE_CAMERA_BASE_URL}/{path}/index.m3u8`.

## Güvenlik

- SRT publish yalnızca doğru passphrase ile (Coolify secret; Git'te yok).
- HLS CORS tek origin'e kilitli (`MTX_HLSALLOWORIGIN`).
- NVR credential'ları bu sunucuya HİÇ gelmez (yalnızca köy bilgisayarında).
- Kayıt/playback kapalı → disk büyümesi yok.

## Domain geçişi (sucullukoyu.net)

1. Coolify'da gateway domainini `https://kamera.sucullukoyu.net` yap.
2. `MTX_HLSALLOWORIGIN=https://sucullukoyu.net` (veya www) güncelle, redeploy.
3. Sitede `VITE_CAMERA_BASE_URL=https://kamera.sucullukoyu.net` güncelle, redeploy.
4. Windows relay `config.env` → `SRT_HOST=kamera.sucullukoyu.net` güncelle,
   `stop.cmd` + `start.cmd`.

Başka hiçbir mimari değişiklik gerekmez. Ayrıntılı işletme:
`docs/CAMERA_DEPLOYMENT_RUNBOOK.md`.
