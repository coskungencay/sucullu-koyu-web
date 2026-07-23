import type {
  CameraDriverErrorKind,
  CameraDriverErrorPayload,
  CameraDriverEvent,
  CameraDriverHandler,
  CameraStreamDriver,
  Scheduler,
  Unsubscribe,
} from '../shared/types';

export const defaultScheduler: Scheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
};

/** Ortak event yönetimi: abone ol/çık, destroy sonrası emisyon yok. */
export abstract class BaseCameraDriver implements CameraStreamDriver {
  protected handlers: Map<CameraDriverEvent, Set<CameraDriverHandler>> = new Map();
  protected destroyed = false;

  abstract attach(video: HTMLVideoElement, url: string): Promise<void>;
  abstract start(): void;
  abstract stop(): void;

  on(event: CameraDriverEvent, handler: CameraDriverHandler): Unsubscribe {
    if (this.destroyed) return () => {};
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  protected emit(event: CameraDriverEvent, payload?: CameraDriverErrorPayload): void {
    if (this.destroyed) return;
    this.handlers.get(event)?.forEach((h) => h(payload));
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.handlers.clear();
  }
}

export type FakeScenario = 'live' | 'offline' | 'loading';

/**
 * Deterministik test sürücüsü: hiçbir ağ isteği yapmaz.
 * - live: kısa gecikmeyle 'playing' yayınlar.
 * - offline: kısa gecikmeyle 'error' yayınlar.
 * - loading: hiçbir event yayınlamaz (spinner kalır).
 * emit() unit testlerde keyfî event dizileri sürmek için public'tir.
 */
export class FakeCameraDriver extends BaseCameraDriver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly scheduler: Scheduler;

  constructor(
    private readonly opts: {
      scenario: FakeScenario;
      scheduler?: Scheduler;
      delayMs?: number;
      errorKind?: CameraDriverErrorKind;
    },
  ) {
    super();
    this.scheduler = opts.scheduler ?? defaultScheduler;
  }

  async attach(_video: HTMLVideoElement, _url: string): Promise<void> {
    // Mock: media attachment yok, ağ isteği yok.
  }

  start(): void {
    if (this.destroyed) return;
    const delay = this.opts.delayMs ?? 200;
    if (this.opts.scenario === 'live') {
      this.timer = this.scheduler.setTimeout(() => this.emit('playing'), delay);
    } else if (this.opts.scenario === 'offline') {
      this.timer = this.scheduler.setTimeout(
        () => this.emit('error', { kind: this.opts.errorKind ?? 'network' }),
        delay,
      );
    }
    // 'loading': bilinçli sessizlik.
  }

  stop(): void {
    if (this.timer !== null) {
      this.scheduler.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Testler için: destroy edilmemişse event yayınlar. */
  emitForTest(event: CameraDriverEvent, payload?: CameraDriverErrorPayload): void {
    this.emit(event, payload);
  }

  destroy(): void {
    this.stop();
    super.destroy();
  }
}
