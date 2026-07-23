import type { CameraPlayerState } from '../shared/types';
import { byHomeOrder, getCameraBaseUrlRaw } from './camera-config';
import { CameraManager } from './camera-manager';
import { resolveCameraMode } from './camera-mode';

/**
 * Ana sayfa kamera preview kartları — kaynak DOM'un birebir kopyası,
 * endpoint hardcode edilmeden config'ten üretilir.
 *
 * - disabled modda (varsayılan) hiçbir player/ağ isteği oluşturulmaz;
 *   kartlar kaynakla aynı loading görünümünde bekler.
 * - Diğer modlarda kaynak davranış korunur: IntersectionObserver
 *   (rootMargin 200px) karta yaklaşınca TEK init yapar.
 *
 * UI eşlemesi (kaynak showLoading/onPlaying/showOffline birebir):
 *   idle/loading/retry-wait/stalled → spinner; playing → video+CANLI;
 *   offline/destroyed → Bağlantı Yok.
 */
export function renderCameraPreviews(): void {
  const grid = document.getElementById('cameraGrid');
  if (!grid) return;

  const wallUrl = '/canli-kamera.html';
  const homeCameras = byHomeOrder();

  for (const cam of homeCameras) {
    const item = document.createElement('div');
    item.className = 'camera-item';
    item.dataset.stream = cam.streamPath;
    item.dataset.label = cam.homeLabel;
    item.dataset.cameraId = cam.id;
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

  const mode = resolveCameraMode({
    baseUrlRaw: getCameraBaseUrlRaw(),
    search: window.location.search,
    allowInsecureLocalhost: import.meta.env.DEV,
  });

  if (mode.mode === 'disabled') {
    // Kontrollü davranış: endpoint yokken istek gönderilmez, loading state korunur.
    return;
  }

  const itemOf = (cameraId: string) =>
    grid.querySelector<HTMLElement>(`.camera-item[data-camera-id="${cameraId}"]`);

  const manager = new CameraManager({
    cameras: homeCameras,
    mode,
    getVideo: (id) => itemOf(id)?.querySelector('video') ?? null,
    onPlayerState: (id, state) => {
      const item = itemOf(id);
      if (item) applyPreviewState(item, state);
    },
  });

  // Kaynak davranış: kart ekrana yaklaşınca yükle; kart başına tek init.
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        observer.unobserve(el);
        const id = el.dataset.cameraId;
        if (id) {
          manager.startCamera(id);
          el.dataset.camInit = 'true';
        }
      });
    },
    { rootMargin: '200px' },
  );
  grid.querySelectorAll('.camera-item').forEach((item) => observer.observe(item));

  exposeDebug(mode.mode, manager);
}

/** Kaynak DOM manipülasyonlarının birebir karşılığı. */
function applyPreviewState(item: HTMLElement, state: CameraPlayerState): void {
  const loading = item.querySelector<HTMLElement>('.cam-loading');
  const offline = item.querySelector<HTMLElement>('.cam-offline');
  const liveTag = item.querySelector<HTMLElement>('.cam-live');
  if (!loading || !offline || !liveTag) return;

  switch (state.status) {
    case 'idle':
    case 'loading':
    case 'retry-wait':
    case 'stalled':
      loading.style.display = 'flex';
      loading.classList.remove('hidden');
      offline.style.display = 'none';
      liveTag.style.opacity = '0.4';
      break;
    case 'playing':
      loading.classList.add('hidden');
      setTimeout(() => {
        loading.style.display = 'none';
      }, 400);
      offline.style.display = 'none';
      liveTag.style.opacity = '1';
      break;
    case 'offline':
    case 'destroyed':
      loading.style.display = 'none';
      offline.style.display = 'flex';
      liveTag.style.opacity = '0.3';
      break;
  }
}

function exposeDebug(mode: string, manager: CameraManager): void {
  if (!mode.startsWith('mock')) return;
  (window as unknown as Record<string, unknown>).__cameraDebug = {
    get driversCreated() {
      return manager.debug.driversCreated;
    },
    get driversAlive() {
      return manager.debug.driversAlive;
    },
    get activeCount() {
      return manager.activeCount;
    },
  };
}
