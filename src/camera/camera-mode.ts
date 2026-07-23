import type { CameraMode, CameraOfflineReason } from '../shared/types';
import { validateCameraBaseUrl } from './camera-url';

/**
 * Merkezi kamera modu çözümleme.
 *
 * - Varsayılan: disabled (hiçbir ağ isteği yok).
 * - live: yalnızca geçerli HTTPS base URL varsa; query ile live moda GEÇİLEMEZ.
 * - Mock modları yalnızca whitelist'teki query değerleriyle seçilir ve asla
 *   ağ isteği üretmez. Bilinmeyen değer disabled'a düşer.
 * - mock-live için `live` parametresi 0–9 arası tam sayı olarak ilk N kamerayı
 *   canlı yapar (render sırasına göre); geçersiz değerde 9 kullanılır.
 */

export type ResolvedCameraMode = {
  mode: CameraMode;
  offlineReason?: CameraOfflineReason;
  /** mock-live: render sırasına göre canlı olacak kamera sayısı (0–9). */
  liveCount: number;
  /** live modda kullanılacak doğrulanmış base URL ('' değilse). */
  baseUrl: string;
};

const MOCK_MODES = new Set<CameraMode>(['mock-loading', 'mock-offline', 'mock-live']);
const TOTAL_CAMERAS = 9;

export function resolveCameraMode(opts: {
  baseUrlRaw?: string | null;
  search?: string;
  allowInsecureLocalhost?: boolean;
}): ResolvedCameraMode {
  const params = new URLSearchParams(opts.search ?? '');
  const requested = params.get('cam');

  if (requested !== null) {
    if (MOCK_MODES.has(requested as CameraMode)) {
      const mode = requested as CameraMode;
      return {
        mode,
        liveCount: mode === 'mock-live' ? parseLiveCount(params.get('live')) : 0,
        baseUrl: '',
      };
    }
    // Bilinmeyen/güvensiz değer → disabled
    return { mode: 'disabled', offlineReason: 'disabled', liveCount: 0, baseUrl: '' };
  }

  const validation = validateCameraBaseUrl(opts.baseUrlRaw, {
    allowInsecureLocalhost: opts.allowInsecureLocalhost,
  });
  if (!validation.ok) {
    return { mode: 'disabled', offlineReason: validation.reason, liveCount: 0, baseUrl: '' };
  }
  return { mode: 'live', liveCount: TOTAL_CAMERAS, baseUrl: validation.baseUrl };
}

function parseLiveCount(raw: string | null): number {
  if (raw === null) return TOTAL_CAMERAS;
  if (!/^\d{1,2}$/.test(raw)) return TOTAL_CAMERAS;
  const n = Number(raw);
  return n >= 0 && n <= TOTAL_CAMERAS ? n : TOTAL_CAMERAS;
}
