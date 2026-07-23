import type {
  CameraDriverErrorKind,
  CameraOfflineReason,
  CameraPlayerState,
} from '../shared/types';

/**
 * Kamera player state machine — saf, unit-testlenebilir.
 *
 * idle → loading → playing → stalled → retry-wait → loading
 * loading/retry-wait → offline
 * herhangi bir state → destroyed (terminal)
 *
 * Geçersiz geçişler state'i DEĞİŞTİRMEZ (koruma); destroyed'dan çıkış yoktur.
 */

export type CameraPlayerEvent =
  | { type: 'START' }
  | { type: 'PLAYING'; at: number }
  | { type: 'ERROR'; kind: CameraDriverErrorKind }
  | { type: 'STALL'; lastProgressAt: number }
  | { type: 'RETRY_DUE' }
  | { type: 'OFFLINE'; reason: CameraOfflineReason }
  | { type: 'DESTROY' };

export type RetryPolicy = {
  /** Bu sayıda hızlı deneme aşılırsa offline(retry-exhausted). */
  maxFastAttempts: number;
  /** attempt (1-based) için mutlak retry zamanı üretir; DI ile deterministik. */
  computeRetryAt: (attempt: number) => number;
};

export function errorKindToOfflineReason(kind: CameraDriverErrorKind): CameraOfflineReason {
  switch (kind) {
    case 'network':
      return 'network-error';
    case 'media':
      return 'media-error';
    case 'manifest':
      return 'manifest-error';
    case 'unsupported':
      return 'unsupported';
  }
}

export function transition(
  state: CameraPlayerState,
  event: CameraPlayerEvent,
  policy: RetryPolicy,
): CameraPlayerState {
  // destroyed terminaldir; hiçbir event çıkaramaz.
  if (state.status === 'destroyed') return state;

  switch (event.type) {
    case 'DESTROY':
      return { status: 'destroyed' };

    case 'OFFLINE':
      return { status: 'offline', reason: event.reason };

    case 'START':
      return state.status === 'idle' ? { status: 'loading', attempt: 0 } : state;

    case 'PLAYING':
      // loading → playing; playing iken duplicate event no-op.
      if (state.status === 'loading') return { status: 'playing', startedAt: event.at };
      return state;

    case 'STALL':
      return state.status === 'playing'
        ? { status: 'stalled', lastProgressAt: event.lastProgressAt }
        : state;

    case 'RETRY_DUE':
      return state.status === 'retry-wait' ? { status: 'loading', attempt: state.attempt } : state;

    case 'ERROR': {
      if (event.kind === 'unsupported') return { status: 'offline', reason: 'unsupported' };
      if (state.status === 'loading') {
        const attempt = state.attempt + 1;
        if (attempt > policy.maxFastAttempts)
          return { status: 'offline', reason: 'retry-exhausted' };
        return { status: 'retry-wait', attempt, retryAt: policy.computeRetryAt(attempt) };
      }
      if (state.status === 'playing' || state.status === 'stalled') {
        // Oynatma koptu: hızlı denemeler baştan başlar.
        return { status: 'retry-wait', attempt: 1, retryAt: policy.computeRetryAt(1) };
      }
      return state;
    }
  }
}
