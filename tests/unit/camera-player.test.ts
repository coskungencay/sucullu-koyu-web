// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeCameraDriver, type FakeScenario } from '../../src/camera/camera-driver';
import { CameraPlayer } from '../../src/camera/camera-player';
import type { CameraPlayerState } from '../../src/shared/types';
import { createFakeScheduler } from './helpers/fake-scheduler';

const RETRY = { baseMs: 3000, maxFastMs: 10000, fastAttempts: 3, healthMs: 60000 };

function setup(scenario: FakeScenario, opts: { stallTimeoutMs?: number } = {}) {
  const fake = createFakeScheduler();
  const video = document.createElement('video');
  const states: CameraPlayerState[] = [];
  const drivers: FakeCameraDriver[] = [];
  const player = new CameraPlayer({
    id: 'cam-test',
    video,
    url: null,
    driverFactory: () => {
      const d = new FakeCameraDriver({ scenario, scheduler: fake.scheduler, delayMs: 200 });
      drivers.push(d);
      return d;
    },
    scheduler: fake.scheduler,
    now: fake.now,
    random: () => 0, // jitter deterministik
    retry: RETRY,
    stallTimeoutMs: opts.stallTimeoutMs ?? 0,
    onStateChange: (s) => states.push(s),
  });
  return { player, fake, video, states, drivers };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('player init idempotence', () => {
  it('start iki kez çağrılırsa tek driver oluşur', async () => {
    const { player, drivers, fake } = setup('live');
    player.start();
    player.start();
    await Promise.resolve();
    fake.advance(300);
    expect(drivers).toHaveLength(1);
    expect(player.getState().status).toBe('playing');
  });
});

describe('retry ve backoff', () => {
  it('hata → retry-wait; deterministik backoff (3000/6000/10000); sonra retry-exhausted', async () => {
    const { player, fake, states, drivers } = setup('offline');
    player.start();
    await Promise.resolve();
    fake.advance(200); // ilk hata
    expect(player.getState()).toMatchObject({ status: 'retry-wait', attempt: 1 });

    await flushAndAdvance(fake, 3000 + 200); // retry 1 + hata
    expect(player.getState()).toMatchObject({ status: 'retry-wait', attempt: 2 });

    await flushAndAdvance(fake, 6000 + 200); // retry 2 + hata
    expect(player.getState()).toMatchObject({ status: 'retry-wait', attempt: 3 });

    await flushAndAdvance(fake, 10000 + 200); // retry 3 + hata → limit aşıldı
    expect(player.getState()).toEqual({ status: 'offline', reason: 'retry-exhausted' });

    // 4 bağlantı denemesi: ilk + 3 retry; hepsi destroy edilmiş olmalı
    expect(drivers).toHaveLength(4);
    expect(states.filter((s) => s.status === 'loading')).toHaveLength(4);
  });

  it('retry-wait sırasında aynı anda tek timer bekler', async () => {
    const { player, fake } = setup('offline');
    player.start();
    await Promise.resolve();
    fake.advance(200);
    expect(player.getState().status).toBe('retry-wait');
    expect(fake.pendingTimeouts()).toBe(1);
  });
});

describe('stall koruması', () => {
  it('ilerleme durursa stalled → retry → yeniden playing', async () => {
    const { player, fake, states, drivers } = setup('live', { stallTimeoutMs: 1000 });
    player.start();
    await Promise.resolve();
    fake.advance(200);
    expect(player.getState().status).toBe('playing');

    await flushAndAdvance(fake, 1000); // timeupdate yok → stall
    expect(states.some((s) => s.status === 'stalled')).toBe(true);
    expect(player.getState()).toMatchObject({ status: 'retry-wait', attempt: 1 });

    await flushAndAdvance(fake, 3000 + 200); // retry → yeni driver playing
    expect(player.getState().status).toBe('playing');
    expect(drivers).toHaveLength(2);
  });

  it('timeupdate stall timer’ını sıfırlar; tek stall timer birikir', async () => {
    const { player, fake, video } = setup('live', { stallTimeoutMs: 1000 });
    player.start();
    await Promise.resolve();
    fake.advance(200);
    expect(player.getState().status).toBe('playing');

    for (let i = 0; i < 3; i++) {
      fake.advance(800);
      video.dispatchEvent(new Event('timeupdate'));
    }
    expect(player.getState().status).toBe('playing');
    // stall timer tek olmalı (retry timer yok)
    expect(fake.pendingTimeouts()).toBe(1);
  });
});

describe('destroy ve callback güvenliği', () => {
  it('destroy idempotenttir; timer/driver temizlenir', async () => {
    const { player, fake, drivers } = setup('offline');
    player.start();
    await Promise.resolve();
    fake.advance(200);
    expect(fake.pendingTimeouts()).toBe(1);
    player.destroy();
    player.destroy();
    expect(player.getState().status).toBe('destroyed');
    expect(fake.pendingTimeouts()).toBe(0);
    expect(drivers).toHaveLength(1);
  });

  it('destroy sonrası bekleyen driver eventi state değiştirmez', async () => {
    const { player, fake, states, drivers } = setup('live');
    player.start();
    await Promise.resolve();
    player.destroy();
    fake.advance(500); // fake driver playing eventi zamanı gelirdi
    drivers[0].emitForTest('playing');
    expect(player.getState().status).toBe('destroyed');
    expect(states[states.length - 1].status).toBe('destroyed');
  });

  it('eski driver aboneliği teardown sonrası state etkileyemez (unsubscribe)', async () => {
    const { player, fake, drivers } = setup('offline');
    player.start();
    await Promise.resolve();
    fake.advance(200); // hata → driver-0 teardown, retry-wait
    const st = player.getState();
    drivers[0].emitForTest('playing');
    expect(player.getState()).toBe(st);
  });

  it('duplicate playing eventi state değiştirmez', async () => {
    const { player, fake, states, drivers } = setup('live');
    player.start();
    await Promise.resolve();
    fake.advance(300);
    const playingCount = () => states.filter((s) => s.status === 'playing').length;
    expect(playingCount()).toBe(1);
    drivers[0].emitForTest('playing');
    drivers[0].emitForTest('playing');
    expect(playingCount()).toBe(1);
    expect(player.getState().status).toBe('playing');
  });
});

/** Mikrotask flush + zaman ilerletme (driver attach promise'leri için). */
async function flushAndAdvance(
  fake: ReturnType<typeof createFakeScheduler>,
  ms: number,
): Promise<void> {
  for (let step = 0; step < ms; step += 100) {
    fake.advance(Math.min(100, ms - step));
    await Promise.resolve();
    await Promise.resolve();
  }
}
