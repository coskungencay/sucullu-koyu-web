import type { CameraPlayerState, Scheduler } from '../shared/types';
import { byWallOrder, getCameraBaseUrlRaw } from './camera-config';
import { defaultScheduler } from './camera-driver';
import { CameraManager } from './camera-manager';
import { resolveCameraMode } from './camera-mode';

/**
 * Kamera duvarı — kaynak buildGrid() DOM çıktısının birebir kopyası +
 * kaynak davranışları (tek hücre büyütme, ses, yenile, tam ekran, f/r/Escape,
 * alt bar autohide, tr-TR saat). Kaynaktaki teknik kusurlar (timer leak,
 * manuel activeCams, sınırsız reconnect) KOPYALANMAZ.
 *
 * disabled modda (varsayılan) hiçbir ağ isteği yapılmaz; hücreler kaynağın
 * doğrulanmış offline görünümünde bekler (BAĞLANIYOR... + BAĞLANTI YOK, 0/9).
 */

type WallInstance = {
  destroy: () => void;
};

let instance: WallInstance | null = null;

export function initCameraWall(scheduler: Scheduler = defaultScheduler): WallInstance | null {
  // Idempotent init: ikinci çağrı yeni listener/interval üretmez.
  if (instance) return instance;

  const grid = document.getElementById('grid');
  const camCount = document.getElementById('camCount');
  const clockEl = document.getElementById('clock');
  const bottombar = document.getElementById('bottombar');
  const muteBtn = document.getElementById('muteBtn');
  if (!grid || !camCount || !clockEl || !bottombar || !muteBtn) return null;

  const wallCameras = byWallOrder();
  const cleanups: Array<() => void> = [];

  // --- Grid (kaynak buildGrid birebir) ---
  wallCameras.forEach((cam, i) => {
    const cell = document.createElement('div');
    cell.className = 'camera-cell';
    cell.id = `cell-${i}`;
    cell.dataset.cameraId = cam.id;
    cell.innerHTML = `
            <div class="loading-overlay" id="loading-${i}">
                <div class="spinner"></div>
                <div class="loading-text">BAĞLANIYOR...</div>
            </div>
            <video id="video-${i}" muted playsinline autoplay></video>
            <div class="camera-label">${cam.wallLabel}</div>
            <div class="camera-status">
                <div class="status-dot" id="dot-${i}"></div>
                <span class="status-text" id="stxt-${i}">BAĞLANIYOR</span>
            </div>
            <button class="close-btn" aria-label="Büyütmeyi kapat">✕ KAPAT</button>
        `;
    // Kaynak davranış: hücre tıklaması büyütmeyi toggle eder.
    cell.addEventListener('click', () => toggleCellFullscreen(cell));
    // Kapat butonu hücre click'ine bubble edip yeniden açmamalı.
    cell.querySelector('.close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      cell.classList.remove('fullscreen');
    });
    grid.appendChild(cell);
  });

  const cellOf = (cameraId: string) =>
    grid.querySelector<HTMLElement>(`.camera-cell[data-camera-id="${cameraId}"]`);

  // --- Mod ve manager ---
  const mode = resolveCameraMode({
    baseUrlRaw: getCameraBaseUrlRaw(),
    search: window.location.search,
    allowInsecureLocalhost: import.meta.env.DEV,
  });

  const setCamCount = (n: number) => {
    camCount.textContent = `${n}/9 AKTİF`;
  };

  let manager: CameraManager | null = null;
  if (mode.mode === 'disabled') {
    // Kaynağın settled offline görünümü; sıfır ağ isteği.
    grid.querySelectorAll('.status-text').forEach((el) => {
      el.textContent = 'BAĞLANTI YOK';
    });
    setCamCount(0);
  } else {
    manager = new CameraManager({
      cameras: wallCameras,
      mode,
      scheduler,
      getVideo: (id) => cellOf(id)?.querySelector('video') ?? null,
      onPlayerState: (id, state) => {
        const cell = cellOf(id);
        if (cell) applyWallState(cell, state);
      },
      onActiveCount: setCamCount,
    });
    manager.startAll();
  }

  // --- Ses (kaynak görünür metin birebir; semantik notu SOURCE_AUDIT'te) ---
  const applyMuteUi = (muted: boolean) => {
    muteBtn.textContent = muted ? '🔇 SES KAPAT' : '🔊 SES AÇ';
    muteBtn.classList.toggle('active', !muted);
    muteBtn.setAttribute('aria-label', muted ? 'Sesi aç' : 'Sesi kapat');
  };
  applyMuteUi(true);
  const onMuteClick = () => {
    if (manager) {
      applyMuteUi(manager.toggleMuted());
    } else {
      // disabled: yalnızca UI state toggle (kaynakta da video yokken görsel davranış budur)
      const nowMuted = muteBtn.classList.contains('active');
      applyMuteUi(nowMuted);
    }
  };
  muteBtn.addEventListener('click', onMuteClick);
  cleanups.push(() => muteBtn.removeEventListener('click', onMuteClick));

  // --- Yenile ---
  const refreshBtn = findButtonByText(bottombar, 'YENİLE');
  const doRefresh = () => {
    grid.querySelectorAll<HTMLElement>('.camera-cell').forEach((cell) => resetCellUi(cell));
    if (manager) {
      manager.refresh();
    } else {
      // disabled: ağ isteği yok; kaynak settled görünümüne geri dön.
      grid.querySelectorAll('.status-text').forEach((el) => {
        el.textContent = 'BAĞLANTI YOK';
      });
      setCamCount(0);
    }
  };
  if (refreshBtn) {
    refreshBtn.addEventListener('click', doRefresh);
    cleanups.push(() => refreshBtn.removeEventListener('click', doRefresh));
  }

  // --- Sayfa tam ekran ---
  const fsBtn = findButtonByText(bottombar, 'TAM EKRAN');
  const toggleFullPage = () => {
    const doc = document as Document & { fullscreenElement?: Element | null };
    if (typeof document.documentElement.requestFullscreen !== 'function') return;
    if (!doc.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };
  const onFsChange = () => {
    const active = Boolean(document.fullscreenElement);
    fsBtn?.setAttribute('aria-pressed', String(active));
  };
  if (fsBtn) {
    fsBtn.setAttribute('aria-pressed', 'false');
    fsBtn.addEventListener('click', toggleFullPage);
    cleanups.push(() => fsBtn.removeEventListener('click', toggleFullPage));
  }
  document.addEventListener('fullscreenchange', onFsChange);
  cleanups.push(() => document.removeEventListener('fullscreenchange', onFsChange));

  // --- Klavye (tek document listener; guard'lar) ---
  const onKeydown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isEditableTarget(e.target)) return;
    if (e.key === 'Escape') {
      document
        .querySelectorAll('.camera-cell.fullscreen')
        .forEach((c) => c.classList.remove('fullscreen'));
    } else if (e.key === 'f') {
      toggleFullPage();
    } else if (e.key === 'r') {
      doRefresh();
    }
  };
  document.addEventListener('keydown', onKeydown);
  cleanups.push(() => document.removeEventListener('keydown', onKeydown));

  // --- Alt bar autohide (tek timer) ---
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  const showBar = () => {
    bottombar.classList.add('visible');
    if (hideTimer !== null) scheduler.clearTimeout(hideTimer);
    hideTimer = scheduler.setTimeout(() => {
      hideTimer = null;
      bottombar.classList.remove('visible');
    }, 3000);
  };
  document.addEventListener('mousemove', showBar);
  document.addEventListener('click', showBar);
  document.addEventListener('touchstart', showBar, { passive: true });
  cleanups.push(() => {
    document.removeEventListener('mousemove', showBar);
    document.removeEventListener('click', showBar);
    document.removeEventListener('touchstart', showBar);
    if (hideTimer !== null) scheduler.clearTimeout(hideTimer);
  });
  showBar();

  // --- Saat (tek interval, tr-TR) ---
  const clockInterval = scheduler.setInterval(() => {
    clockEl.textContent = new Date().toLocaleTimeString('tr-TR');
  }, 1000);
  cleanups.push(() => scheduler.clearInterval(clockInterval));

  // --- Debug (yalnızca mock modlar) ---
  if (mode.mode.startsWith('mock') && manager) {
    const m = manager;
    (window as unknown as Record<string, unknown>).__cameraDebug = {
      get driversCreated() {
        return m.debug.driversCreated;
      },
      get driversAlive() {
        return m.debug.driversAlive;
      },
      get activeCount() {
        return m.activeCount;
      },
    };
  }

  instance = {
    destroy: () => {
      manager?.destroyAll();
      cleanups.forEach((fn) => fn());
      instance = null;
    },
  };
  return instance;
}

/** Aynı anda yalnızca bir hücre büyütülebilir (kaynak davranışı). */
export function toggleCellFullscreen(cell: HTMLElement): void {
  const wasFullscreen = cell.classList.contains('fullscreen');
  document
    .querySelectorAll('.camera-cell.fullscreen')
    .forEach((c) => c.classList.remove('fullscreen'));
  if (!wasFullscreen) cell.classList.add('fullscreen');
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** Kaynak UI eşlemesi: durum rozeti + loading overlay. */
function applyWallState(cell: HTMLElement, state: CameraPlayerState): void {
  const dot = cell.querySelector<HTMLElement>('.status-dot');
  const stxt = cell.querySelector<HTMLElement>('.status-text');
  const loading = cell.querySelector<HTMLElement>('.loading-overlay');
  if (!dot || !stxt || !loading) return;

  switch (state.status) {
    case 'idle':
    case 'loading':
    case 'retry-wait':
    case 'stalled':
      dot.classList.remove('live');
      stxt.textContent = 'BAĞLANIYOR';
      loading.classList.remove('hidden');
      break;
    case 'playing':
      dot.classList.add('live');
      stxt.textContent = 'CANLI';
      loading.classList.add('hidden');
      break;
    case 'offline':
    case 'destroyed':
      dot.classList.remove('live');
      stxt.textContent = 'BAĞLANTI YOK';
      loading.classList.remove('hidden');
      break;
  }
}

function resetCellUi(cell: HTMLElement): void {
  cell.querySelector('.loading-overlay')?.classList.remove('hidden');
  cell.querySelector('.status-dot')?.classList.remove('live');
  const stxt = cell.querySelector('.status-text');
  if (stxt) stxt.textContent = 'BAĞLANIYOR';
}

function findButtonByText(root: HTMLElement, text: string): HTMLElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLElement>('button.btn')).find((b) =>
      (b.textContent ?? '').includes(text),
    ) ?? null
  );
}

initCameraWall();
