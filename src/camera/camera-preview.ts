import { byHomeOrder, getCameraBaseUrl } from './camera-config';

/**
 * Ana sayfa kamera preview kartları — kaynak DOM'un birebir kopyası,
 * fakat endpoint hardcode edilmeden config'ten üretilir.
 *
 * Base URL tanımlı değilken (bu sprintte) hiçbir ağ isteği yapılmaz;
 * kartlar kaynakla aynı loading görünümünde bekler. Gerçek HLS player
 * yaşam döngüsü Sprint 3 kapsamındadır.
 */
export function renderCameraPreviews(): void {
  const grid = document.getElementById('cameraGrid');
  if (!grid) return;

  const wallUrl = 'https://sucullukoyu.com/canli-kamera.html';

  for (const cam of byHomeOrder()) {
    const item = document.createElement('div');
    item.className = 'camera-item';
    item.dataset.stream = cam.streamPath;
    item.dataset.label = cam.homeLabel;
    item.innerHTML = `
          <div class="camera-video-wrap">
            <video muted playsinline autoplay></video>
            <div class="cam-overlay">
              <span class="cam-live"><i class="fas fa-circle"></i> CANLI</span>
              <span class="cam-label">${cam.homeLabel}</span>
              <a class="cam-fullscreen" href="${wallUrl}" target="_blank" title="Tam Ekran"><i class="fas fa-expand"></i></a>
            </div>
            <div class="cam-loading"><i class="fas fa-spinner fa-spin"></i></div>
            <div class="cam-offline" style="display:none"><i class="fas fa-video-slash"></i><span>Bağlantı Yok</span></div>
          </div>`;
    grid.appendChild(item);
  }

  const baseUrl = getCameraBaseUrl();
  if (!baseUrl) {
    // Kontrollü davranış: endpoint yokken istek gönderilmez, loading state korunur.
    return;
  }

  // Sprint 3: baseUrl tanımlandığında state-machine tabanlı player burada bağlanacak
  // (tek HLS instance/kamera, backoff+jitter, tam temizlik). Bu sprintte bilinçli boş.
}
