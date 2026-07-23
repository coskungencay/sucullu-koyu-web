import type { CameraConfig, CameraPlayerState } from '../shared/types';
import cameraMap from './camera-current-map.json';

/**
 * Tek kamera veri kaynağı: sucullu-cto-pack/camera-current-map.json snapshot'ı.
 * Ana sayfa ve kamera duvarı etiket/sıra farklılıkları kaynaktaki doğrulanmış
 * tutarsızlıktır ve müşteri onayına kadar bilinçli olarak korunur.
 */
export const cameras: CameraConfig[] = cameraMap.cameras.map((c) => ({ ...c, enabled: true }));

/** Base URL env üzerinden gelir; tanımlı değilse hiçbir ağ isteği yapılmaz. */
export function getCameraBaseUrl(
  env: Record<string, string | undefined> = import.meta.env,
): string {
  const raw = env.VITE_CAMERA_BASE_URL ?? '';
  return raw.trim().replace(/\/+$/, '');
}

export function buildManifestUrl(baseUrl: string, streamPath: string): string | null {
  if (!baseUrl) return null;
  return `${baseUrl}/${streamPath}/index.m3u8`;
}

export function byHomeOrder(list: CameraConfig[] = cameras): CameraConfig[] {
  return [...list].sort((a, b) => a.homeOrder - b.homeOrder);
}

export function byWallOrder(list: CameraConfig[] = cameras): CameraConfig[] {
  return [...list].sort((a, b) => a.wallOrder - b.wallOrder);
}

/** Aktif sayaç state set'inden türetilir; manuel ++/-- yasak (CTO 7.3). */
export function deriveActiveCount(states: Iterable<CameraPlayerState>): number {
  let n = 0;
  for (const s of states) if (s === 'playing') n++;
  return n;
}

/** Exponential backoff + jitter; hızlı denemeler sınırlı, sonrası seyrek health retry. */
export function retryDelayMs(
  attempt: number,
  opts = { baseMs: 3000, maxFastMs: 10000, fastAttempts: 5, healthMs: 60000 },
  random: () => number = Math.random,
): number {
  if (attempt >= opts.fastAttempts) return opts.healthMs;
  const exp = Math.min(opts.baseMs * 2 ** attempt, opts.maxFastMs);
  const jitter = exp * 0.2 * random();
  return Math.round(exp + jitter);
}
