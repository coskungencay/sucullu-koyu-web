import { describe, expect, it } from 'vitest';
import {
  byHomeOrder,
  byWallOrder,
  cameras,
  deriveActiveCount,
  getCameraBaseUrlRaw,
  retryDelayMs,
} from '../../src/camera/camera-config';
import { buildManifestUrl } from '../../src/camera/camera-url';
import type { CameraPlayerState } from '../../src/shared/types';

describe('camera config', () => {
  it('dokuz kamera içerir', () => {
    expect(cameras).toHaveLength(9);
  });

  it('ana sayfa sırası kaynaktaki gibi (kamera6 3. sırada, etiketi KAMERA 04)', () => {
    const home = byHomeOrder();
    expect(home.map((c) => c.streamPath)).toEqual([
      'kamera1',
      'kamera2',
      'kamera6',
      'kamera5',
      'kamera7',
      'kamera8',
      'kamera11',
      'kamera10',
      'p850',
    ]);
    expect(home[2].homeLabel).toBe('KAMERA 04');
    expect(home[8].homeLabel).toBe('P850');
  });

  it('duvar sırası kaynaktaki gibi (7-8 ana sayfadan farklı, etiketler ardışık)', () => {
    const wall = byWallOrder();
    expect(wall.map((c) => c.streamPath)).toEqual([
      'kamera1',
      'kamera2',
      'kamera6',
      'kamera5',
      'kamera7',
      'kamera8',
      'kamera10',
      'kamera11',
      'p850',
    ]);
    expect(wall.map((c) => c.wallLabel)).toEqual([
      'KAMERA 01',
      'KAMERA 02',
      'KAMERA 03',
      'KAMERA 04',
      'KAMERA 05',
      'KAMERA 06',
      'KAMERA 07',
      'KAMERA 08',
      'KAMERA 09',
    ]);
  });
});

describe('URL builder', () => {
  it('base URL yoksa null döner — ağ isteği yapılmamalı', () => {
    expect(buildManifestUrl('', 'kamera1')).toBeNull();
  });

  it('manifest kalıbını üretir', () => {
    expect(buildManifestUrl('https://example.test', 'kamera1')).toBe(
      'https://example.test/kamera1/index.m3u8',
    );
  });

  it('ham env değeri okunur (doğrulama camera-url/camera-mode katmanında)', () => {
    expect(getCameraBaseUrlRaw({})).toBe('');
    expect(getCameraBaseUrlRaw({ VITE_CAMERA_BASE_URL: 'https://example.test/' })).toBe(
      'https://example.test/',
    );
  });
});

describe('aktif kamera sayısı türetme', () => {
  it('yalnızca playing durumundakileri sayar', () => {
    const states: CameraPlayerState[] = [
      { status: 'playing', startedAt: 1 },
      { status: 'loading', attempt: 0 },
      { status: 'offline', reason: 'network-error' },
      { status: 'playing', startedAt: 2 },
      { status: 'retry-wait', attempt: 1, retryAt: 100 },
      { status: 'stalled', lastProgressAt: 50 },
    ];
    expect(deriveActiveCount(states)).toBe(2);
    expect(deriveActiveCount([])).toBe(0);
  });
});

describe('retry backoff', () => {
  it('üstel artar, hızlı deneme tavanını aşmaz', () => {
    const noJitter = () => 0;
    expect(retryDelayMs(0, undefined, noJitter)).toBe(3000);
    expect(retryDelayMs(1, undefined, noJitter)).toBe(6000);
    expect(retryDelayMs(2, undefined, noJitter)).toBe(10000);
    expect(retryDelayMs(4, undefined, noJitter)).toBe(10000);
  });

  it('hızlı deneme sınırından sonra seyrek health retry', () => {
    expect(retryDelayMs(5)).toBe(60000);
    expect(retryDelayMs(50)).toBe(60000);
  });

  it('jitter gecikmeyi en fazla %20 artırır', () => {
    const maxJitter = () => 1;
    expect(retryDelayMs(0, undefined, maxJitter)).toBe(3600);
  });
});
