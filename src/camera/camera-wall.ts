import { byWallOrder, getCameraBaseUrl } from './camera-config';

/**
 * Kamera duvarı rota iskeleti — kaynak buildGrid() DOM çıktısının birebir kopyası,
 * endpoint hardcode edilmeden config'ten üretilir.
 *
 * Base URL tanımlı değilken hiçbir ağ isteği yapılmaz; hücreler kaynağın
 * doğrulanmış offline görünümünde bekler (spinner + BAĞLANIYOR... + durum
 * rozeti BAĞLANTI YOK, 0/9 AKTİF). Player yaşam döngüsü, tek hücre büyütme,
 * ses/yenile/tam ekran ve klavye kontrolleri Sprint 3 kapsamındadır.
 */
function buildGrid(): void {
  const grid = document.getElementById('grid');
  if (!grid) return;

  byWallOrder().forEach((cam, i) => {
    const cell = document.createElement('div');
    cell.className = 'camera-cell';
    cell.id = `cell-${i}`;
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
            <button class="close-btn">✕ KAPAT</button>
        `;
    grid.appendChild(cell);
  });
}

/** Base URL yokken kaynakla aynı settled offline durumu: durum rozetleri BAĞLANTI YOK. */
function showOfflineState(): void {
  document.querySelectorAll('.status-text').forEach((el) => {
    el.textContent = 'BAĞLANTI YOK';
  });
  const camCount = document.getElementById('camCount');
  if (camCount) camCount.textContent = '0/9 AKTİF';
}

function startClock(): void {
  const clock = document.getElementById('clock');
  if (!clock) return;
  setInterval(() => {
    clock.textContent = new Date().toLocaleTimeString('tr-TR');
  }, 1000);
}

function initBottombar(): void {
  const bottombar = document.getElementById('bottombar');
  if (!bottombar) return;
  let hideTimer: ReturnType<typeof setTimeout>;
  const showBar = () => {
    bottombar.classList.add('visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => bottombar.classList.remove('visible'), 3000);
  };
  document.addEventListener('mousemove', showBar);
  document.addEventListener('click', showBar);
  showBar();
}

buildGrid();
startClock();
initBottombar();

const baseUrl = getCameraBaseUrl();
if (!baseUrl) {
  showOfflineState();
} else {
  // Sprint 3: hls.js@1.4.12 dynamic import + state-machine player burada bağlanacak.
}
