// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { cameras, byWallOrder } from '../../src/camera/camera-config';
import { FakeCameraDriver } from '../../src/camera/camera-driver';
import { CameraManager } from '../../src/camera/camera-manager';
import type { ResolvedCameraMode } from '../../src/camera/camera-mode';
import { createFakeScheduler } from './helpers/fake-scheduler';

function setup(
  mode: Partial<ResolvedCameraMode> & { mode: ResolvedCameraMode['mode'] },
  extra: {
    retryOverride?: { baseMs: number; maxFastMs: number; fastAttempts: number; healthMs: number };
  } = {},
) {
  const fake = createFakeScheduler();
  const wall = byWallOrder(cameras);
  const videos = new Map<string, HTMLVideoElement>();
  for (const cam of wall) {
    const v = document.createElement('video');
    document.body.appendChild(v);
    videos.set(cam.id, v);
  }
  const counts: number[] = [];
  const drivers: FakeCameraDriver[] = [];
  const manager = new CameraManager({
    cameras: wall,
    mode: { liveCount: 0, baseUrl: '', ...mode },
    scheduler: fake.scheduler,
    getVideo: (id) => videos.get(id) ?? null,
    onActiveCount: (n) => counts.push(n),
    retryOverride: extra.retryOverride,
    driverFactoryOverride:
      mode.mode === 'live'
        ? undefined
        : (_cam, index) => {
            const { liveCount = 0 } = mode;
            const scenario =
              mode.mode === 'mock-loading'
                ? 'loading'
                : mode.mode === 'mock-offline'
                  ? 'offline'
                  : index < liveCount
                    ? 'live'
                    : 'offline';
            const d = new FakeCameraDriver({ scenario, scheduler: fake.scheduler, delayMs: 200 });
            drivers.push(d);
            return d;
          },
  });
  return { manager, fake, videos, counts, drivers, wall };
}

async function settle(fake: ReturnType<typeof createFakeScheduler>, ms = 400) {
  for (let t = 0; t < ms; t += 100) {
    fake.advance(100);
    await Promise.resolve();
    await Promise.resolve();
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('deterministik senaryolar ve aktif sayaç', () => {
  it('mock-offline: 0/9 aktif', async () => {
    const { manager, fake } = setup({ mode: 'mock-offline' });
    manager.startAll();
    await settle(fake);
    expect(manager.activeCount).toBe(0);
  });

  it('mock-live: 9/9 aktif', async () => {
    const { manager, fake } = setup({ mode: 'mock-live', liveCount: 9 });
    manager.startAll();
    await settle(fake);
    expect(manager.activeCount).toBe(9);
  });

  it('mock-live live=3: 3/9 aktif (render sırasına göre ilk üç)', async () => {
    const { manager, fake, wall } = setup({ mode: 'mock-live', liveCount: 3 });
    manager.startAll();
    await settle(fake);
    expect(manager.activeCount).toBe(3);
    expect(manager.getState(wall[0].id)?.status).toBe('playing');
    expect(manager.getState(wall[3].id)?.status).toBe('offline');
  });

  it('mock-loading: kalıcı loading, sayaç 0', async () => {
    const { manager, fake, wall } = setup({ mode: 'mock-loading' });
    manager.startAll();
    await settle(fake, 2000);
    expect(manager.activeCount).toBe(0);
    expect(manager.getState(wall[0].id)?.status).toBe('loading');
  });

  it('duplicate playing eventi sayacı şişirmez', async () => {
    const { manager, fake, drivers } = setup({ mode: 'mock-live', liveCount: 1 });
    manager.startAll();
    await settle(fake);
    expect(manager.activeCount).toBe(1);
    drivers[0].emitForTest('playing');
    drivers[0].emitForTest('playing');
    expect(manager.activeCount).toBe(1);
  });

  it('playing → error → retry → playing geçişinde sayaç doğru kalır', async () => {
    const { manager, fake, drivers } = setup(
      { mode: 'mock-live', liveCount: 9 },
      { retryOverride: { baseMs: 3000, maxFastMs: 10000, fastAttempts: 5, healthMs: 60000 } },
    );
    manager.startAll();
    await settle(fake);
    expect(manager.activeCount).toBe(9);
    // bir kamerayı düşür
    drivers[0].emitForTest('error', { kind: 'network' });
    expect(manager.activeCount).toBe(8);
    // backoff (3000+jitter) + yeni driver playing (200)
    await settle(fake, 4200);
    expect(manager.activeCount).toBe(9);
  });
});

describe('startCamera idempotence', () => {
  it('aynı kamera için ikinci çağrı yeni player/driver oluşturmaz', async () => {
    const { manager, fake, wall } = setup({ mode: 'mock-live', liveCount: 9 });
    manager.startCamera(wall[0].id);
    manager.startCamera(wall[0].id);
    await settle(fake);
    expect(manager.debug.driversCreated).toBe(1);
  });

  it('disabled modda hiçbir player oluşturulmaz', () => {
    const { manager } = setup({ mode: 'disabled' });
    manager.startAll();
    expect(manager.debug.driversCreated).toBe(0);
  });
});

describe('refresh yaşam döngüsü', () => {
  it('refresh: hepsi destroy + yeniden init; driversAlive 9’u aşmaz', async () => {
    const { manager, fake } = setup({ mode: 'mock-live', liveCount: 9 });
    manager.startAll();
    await settle(fake);
    expect(manager.debug.driversAlive).toBe(9);
    manager.refresh();
    expect(manager.activeCount).toBe(0);
    await settle(fake);
    expect(manager.activeCount).toBe(9);
    expect(manager.debug.driversCreated).toBe(18);
    expect(manager.debug.driversAlive).toBe(9);
  });

  it('hızlı refresh spam instance/timer çoğaltmaz', async () => {
    const { manager, fake } = setup({ mode: 'mock-live', liveCount: 9 });
    manager.startAll();
    for (let i = 0; i < 5; i++) manager.refresh();
    await settle(fake);
    expect(manager.debug.driversAlive).toBe(9);
    expect(manager.activeCount).toBe(9);
  });

  it('destroyAll: sayaç 0, canlı driver kalmaz', async () => {
    const { manager, fake } = setup({ mode: 'mock-live', liveCount: 9 });
    manager.startAll();
    await settle(fake);
    manager.destroyAll();
    expect(manager.activeCount).toBe(0);
    expect(manager.debug.driversAlive).toBe(0);
  });
});

describe('global mute state', () => {
  it('varsayılan muted; toggle tüm videolara uygulanır', async () => {
    const { manager, fake, videos } = setup({ mode: 'mock-live', liveCount: 9 });
    manager.startAll();
    await settle(fake);
    expect([...videos.values()].every((v) => v.muted)).toBe(true);
    expect(manager.toggleMuted()).toBe(false);
    expect([...videos.values()].every((v) => !v.muted)).toBe(true);
  });

  it('refresh sonrası mute state korunur; yeni videolar devralır', async () => {
    const { manager, fake, videos } = setup({ mode: 'mock-live', liveCount: 9 });
    manager.startAll();
    await settle(fake);
    manager.setMuted(false);
    manager.refresh();
    await settle(fake);
    expect(manager.muted).toBe(false);
    expect([...videos.values()].every((v) => !v.muted)).toBe(true);
  });
});
