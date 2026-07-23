import type { CameraPlayerState, CameraStreamDriver, Scheduler } from '../shared/types';
import { defaultScheduler } from './camera-driver';
import { retryDelayMs } from './camera-config';
import { transition, type CameraPlayerEvent, type RetryPolicy } from './camera-state';

export type CameraPlayerOptions = {
  id: string;
  video: HTMLVideoElement;
  /** live modda manifest URL'i; mock driver'lar için null. */
  url: string | null;
  driverFactory: () => CameraStreamDriver;
  onStateChange?: (state: CameraPlayerState) => void;
  scheduler?: Scheduler;
  now?: () => number;
  random?: () => number;
  retry?: { baseMs: number; maxFastMs: number; fastAttempts: number; healthMs: number };
  /** 0 veya undefined → stall watchdog kapalı (mock modlar). */
  stallTimeoutMs?: number;
};

/**
 * Kamera başına güvenilir yaşam döngüsü:
 * - Aynı anda tek driver instance; reconnect öncesi eskisi tamamen destroy edilir.
 * - Tek retry timer'ı; yeni retry planlanınca eskisi temizlenir.
 * - Tek stall timer'ı; video ilerlemesi durursa driver yenilenir.
 * - destroy() idempotenttir; sonrasında hiçbir callback state değiştiremez.
 * - start() idempotenttir; iki kez çağrılması ikinci instance oluşturmaz.
 */
export class CameraPlayer {
  private state: CameraPlayerState = { status: 'idle' };
  private driver: CameraStreamDriver | null = null;
  private unsubs: Array<() => void> = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private stallListener: EventListener | null = null;
  private started = false;

  private readonly scheduler: Scheduler;
  private readonly now: () => number;
  private readonly policy: RetryPolicy;
  private readonly retryOpts: {
    baseMs: number;
    maxFastMs: number;
    fastAttempts: number;
    healthMs: number;
  };

  constructor(private readonly opts: CameraPlayerOptions) {
    this.scheduler = opts.scheduler ?? defaultScheduler;
    this.now = opts.now ?? Date.now;
    this.retryOpts = opts.retry ?? {
      baseMs: 3000,
      maxFastMs: 10000,
      fastAttempts: 5,
      healthMs: 60000,
    };
    const random = opts.random ?? Math.random;
    this.policy = {
      maxFastAttempts: this.retryOpts.fastAttempts,
      computeRetryAt: (attempt) => this.now() + retryDelayMs(attempt - 1, this.retryOpts, random),
    };
  }

  getState(): CameraPlayerState {
    return this.state;
  }

  start(): void {
    if (this.started || this.state.status === 'destroyed') return;
    this.started = true;
    this.dispatch({ type: 'START' });
    this.connect();
  }

  destroy(): void {
    if (this.state.status === 'destroyed') return;
    this.clearRetryTimer();
    this.teardownDriver();
    this.dispatch({ type: 'DESTROY' });
  }

  private dispatch(event: CameraPlayerEvent): void {
    const next = transition(this.state, event, this.policy);
    if (next === this.state) return;
    this.state = next;
    this.opts.onStateChange?.(next);
  }

  private connect(): void {
    if (this.state.status === 'destroyed') return;
    this.teardownDriver();
    const driver = this.opts.driverFactory();
    this.driver = driver;
    this.unsubs.push(driver.on('playing', () => this.handlePlaying()));
    this.unsubs.push(driver.on('error', (p) => this.handleError(p?.kind ?? 'network')));
    driver
      .attach(this.opts.video, this.opts.url ?? '')
      .then(() => {
        if (this.driver === driver && this.state.status !== 'destroyed') driver.start();
      })
      .catch(() => this.handleError('network'));
  }

  private handlePlaying(): void {
    if (this.state.status === 'destroyed') return;
    // Duplicate 'playing' event state'i (ve aktif sayacı) değiştirmez.
    this.dispatch({ type: 'PLAYING', at: this.now() });
    this.armStallWatchdog();
  }

  private handleError(kind: 'network' | 'media' | 'manifest' | 'unsupported'): void {
    if (this.state.status === 'destroyed') return;
    this.teardownDriver();
    this.dispatch({ type: 'ERROR', kind });
    if (this.state.status === 'retry-wait') {
      this.scheduleRetry(this.state.retryAt);
    }
  }

  private scheduleRetry(retryAt: number): void {
    this.clearRetryTimer();
    const delay = Math.max(0, retryAt - this.now());
    this.retryTimer = this.scheduler.setTimeout(() => {
      this.retryTimer = null;
      if (this.state.status === 'destroyed') return;
      this.dispatch({ type: 'RETRY_DUE' });
      if (this.state.status === 'loading') this.connect();
    }, delay);
  }

  private armStallWatchdog(): void {
    const timeout = this.opts.stallTimeoutMs ?? 0;
    if (timeout <= 0) return;
    this.clearStallTimer();
    if (!this.stallListener) {
      this.stallListener = () => {
        if (this.state.status === 'playing') this.armStallWatchdog();
      };
      this.opts.video.addEventListener('timeupdate', this.stallListener);
    }
    this.stallTimer = this.scheduler.setTimeout(() => {
      this.stallTimer = null;
      if (this.state.status !== 'playing') return;
      this.dispatch({ type: 'STALL', lastProgressAt: this.now() });
      // Stall sonrası: eski driver destroy edilir, yeniden bağlantı planlanır.
      this.handleError('network');
    }, timeout);
  }

  private teardownDriver(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.driver) {
      this.driver.destroy();
      this.driver = null;
    }
    this.clearStallTimer();
    if (this.stallListener) {
      this.opts.video.removeEventListener('timeupdate', this.stallListener);
      this.stallListener = null;
    }
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      this.scheduler.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private clearStallTimer(): void {
    if (this.stallTimer !== null) {
      this.scheduler.clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
  }
}
