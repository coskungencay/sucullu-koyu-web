import { describe, expect, it } from 'vitest';
import {
  errorKindToOfflineReason,
  transition,
  type RetryPolicy,
} from '../../src/camera/camera-state';
import type { CameraPlayerState } from '../../src/shared/types';

const policy: RetryPolicy = {
  maxFastAttempts: 3,
  computeRetryAt: (attempt) => 1000 * attempt,
};

const idle: CameraPlayerState = { status: 'idle' };
const loading0: CameraPlayerState = { status: 'loading', attempt: 0 };
const playing: CameraPlayerState = { status: 'playing', startedAt: 42 };

describe('state machine geçişleri', () => {
  it('idle → loading (START)', () => {
    expect(transition(idle, { type: 'START' }, policy)).toEqual({ status: 'loading', attempt: 0 });
  });

  it('loading → playing (PLAYING)', () => {
    expect(transition(loading0, { type: 'PLAYING', at: 42 }, policy)).toEqual(playing);
  });

  it('loading → retry-wait (ERROR, attempt < max)', () => {
    expect(transition(loading0, { type: 'ERROR', kind: 'network' }, policy)).toEqual({
      status: 'retry-wait',
      attempt: 1,
      retryAt: 1000,
    });
  });

  it('retry-wait → loading (RETRY_DUE), attempt korunur', () => {
    const rw: CameraPlayerState = { status: 'retry-wait', attempt: 2, retryAt: 2000 };
    expect(transition(rw, { type: 'RETRY_DUE' }, policy)).toEqual({
      status: 'loading',
      attempt: 2,
    });
  });

  it('loading → offline(retry-exhausted) hızlı deneme sınırı aşılınca', () => {
    const loading3: CameraPlayerState = { status: 'loading', attempt: 3 };
    expect(transition(loading3, { type: 'ERROR', kind: 'network' }, policy)).toEqual({
      status: 'offline',
      reason: 'retry-exhausted',
    });
  });

  it('playing → stalled (STALL)', () => {
    expect(transition(playing, { type: 'STALL', lastProgressAt: 99 }, policy)).toEqual({
      status: 'stalled',
      lastProgressAt: 99,
    });
  });

  it('playing/stalled → retry-wait (ERROR); hızlı denemeler baştan başlar', () => {
    expect(transition(playing, { type: 'ERROR', kind: 'network' }, policy)).toEqual({
      status: 'retry-wait',
      attempt: 1,
      retryAt: 1000,
    });
    const stalled: CameraPlayerState = { status: 'stalled', lastProgressAt: 99 };
    expect(transition(stalled, { type: 'ERROR', kind: 'media' }, policy)).toEqual({
      status: 'retry-wait',
      attempt: 1,
      retryAt: 1000,
    });
  });

  it('unsupported hatası anında offline(unsupported)', () => {
    expect(transition(loading0, { type: 'ERROR', kind: 'unsupported' }, policy)).toEqual({
      status: 'offline',
      reason: 'unsupported',
    });
  });

  it('OFFLINE eventi her reason ile doğrudan offline üretir', () => {
    expect(transition(idle, { type: 'OFFLINE', reason: 'missing-base-url' }, policy)).toEqual({
      status: 'offline',
      reason: 'missing-base-url',
    });
  });

  it('herhangi bir state → destroyed (DESTROY)', () => {
    for (const s of [idle, loading0, playing]) {
      expect(transition(s, { type: 'DESTROY' }, policy)).toEqual({ status: 'destroyed' });
    }
  });
});

describe('geçersiz geçiş koruması', () => {
  it('destroyed terminaldir; hiçbir event çıkaramaz', () => {
    const destroyed: CameraPlayerState = { status: 'destroyed' };
    expect(transition(destroyed, { type: 'START' }, policy)).toBe(destroyed);
    expect(transition(destroyed, { type: 'PLAYING', at: 1 }, policy)).toBe(destroyed);
    expect(transition(destroyed, { type: 'ERROR', kind: 'network' }, policy)).toBe(destroyed);
    expect(transition(destroyed, { type: 'OFFLINE', reason: 'disabled' }, policy)).toBe(destroyed);
  });

  it('duplicate PLAYING state değiştirmez (referans aynı kalır)', () => {
    expect(transition(playing, { type: 'PLAYING', at: 99 }, policy)).toBe(playing);
  });

  it('playing olmayan state STALL almaz; retry-wait olmayan RETRY_DUE almaz', () => {
    expect(transition(loading0, { type: 'STALL', lastProgressAt: 1 }, policy)).toBe(loading0);
    expect(transition(playing, { type: 'RETRY_DUE' }, policy)).toBe(playing);
    expect(transition(idle, { type: 'PLAYING', at: 1 }, policy)).toBe(idle);
    expect(transition(idle, { type: 'ERROR', kind: 'network' }, policy)).toBe(idle);
  });

  it('START yalnızca idle iken çalışır', () => {
    expect(transition(playing, { type: 'START' }, policy)).toBe(playing);
    expect(transition(loading0, { type: 'START' }, policy)).toBe(loading0);
  });
});

describe('hata türü → offline reason eşlemesi', () => {
  it('bütün kind değerleri eşlenir', () => {
    expect(errorKindToOfflineReason('network')).toBe('network-error');
    expect(errorKindToOfflineReason('media')).toBe('media-error');
    expect(errorKindToOfflineReason('manifest')).toBe('manifest-error');
    expect(errorKindToOfflineReason('unsupported')).toBe('unsupported');
  });
});
