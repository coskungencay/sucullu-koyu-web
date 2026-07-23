import type {
  CameraConfig,
  CameraPlayerState,
  CameraStreamDriver,
  Scheduler,
} from '../shared/types';
import type { ResolvedCameraMode } from './camera-mode';
import { FakeCameraDriver } from './camera-driver';
import { HlsCameraDriver } from './hls-driver';
import { CameraPlayer } from './camera-player';
import { buildManifestUrl } from './camera-url';

export type CameraManagerOptions = {
  /** Render sırasına göre kameralar (ana sayfa: homeOrder, duvar: wallOrder). */
  cameras: CameraConfig[];
  mode: ResolvedCameraMode;
  getVideo: (cameraId: string) => HTMLVideoElement | null;
  onPlayerState?: (cameraId: string, state: CameraPlayerState) => void;
  onActiveCount?: (count: number) => void;
  scheduler?: Scheduler;
  now?: () => number;
  random?: () => number;
  /** Testler için sürücü fabrikası override'ı. */
  driverFactoryOverride?: (camera: CameraConfig, index: number) => CameraStreamDriver;
  /** Testler için retry politikası override'ı. */
  retryOverride?: { baseMs: number; maxFastMs: number; fastAttempts: number; healthMs: number };
};

/**
 * Mock modlarda retry döngüsü DEVRE DIŞI (fastAttempts: 0): ilk hata anında
 * offline(retry-exhausted) üretir. Böylece mock-offline/mock-live senaryoları
 * Playwright ve visual regression için deterministiktir. Gerçek retry/backoff
 * davranışı player unit testlerinde ve live modda geçerlidir.
 */
const MOCK_RETRY = { baseMs: 200, maxFastMs: 200, fastAttempts: 0, healthMs: 3_600_000 };

/**
 * Kamera koleksiyonu yönetimi:
 * - Aktif sayı DAİMA player state set'inden türetilir; manuel sayaç yok.
 * - Global mute state tek yerde tutulur; yeni/yeniden oluşturulan videolar
 *   mevcut mute durumunu devralır; refresh sonrasında kaybolmaz.
 * - refresh(): tüm player'lar güvenli destroy edilir ve mod uygunsa yeniden
 *   oluşturulur; hızlı ardışık çağrılar instance/timer çoğaltmaz.
 * - disabled modda hiçbir player/ağ isteği oluşturulmaz.
 */
export class CameraManager {
  private players = new Map<string, CameraPlayer>();
  private mutedState = true;
  /** Debug/test: toplam oluşturulan ve halen yaşayan driver sayısı. */
  readonly debug = { driversCreated: 0, driversAlive: 0 };

  constructor(private readonly opts: CameraManagerOptions) {}

  get muted(): boolean {
    return this.mutedState;
  }

  get activeCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.getState().status === 'playing') n++;
    return n;
  }

  getState(cameraId: string): CameraPlayerState | null {
    return this.players.get(cameraId)?.getState() ?? null;
  }

  /** Bir kamera için player oluşturup başlatır; kamera başına tek init. */
  startCamera(cameraId: string): void {
    if (this.opts.mode.mode === 'disabled') return;
    if (this.players.has(cameraId)) return;
    const index = this.opts.cameras.findIndex((c) => c.id === cameraId);
    if (index < 0) return;
    const camera = this.opts.cameras[index];
    const video = this.opts.getVideo(cameraId);
    if (!video) return;

    video.muted = this.mutedState;
    const isLive = this.opts.mode.mode === 'live';
    const player = new CameraPlayer({
      id: camera.id,
      video,
      url: isLive ? buildManifestUrl(this.opts.mode.baseUrl, camera.streamPath) : null,
      driverFactory: () => this.createDriver(camera, index),
      scheduler: this.opts.scheduler,
      now: this.opts.now,
      random: this.opts.random,
      retry: this.opts.retryOverride ?? (isLive ? undefined : MOCK_RETRY),
      stallTimeoutMs: isLive ? 15000 : 0,
      onStateChange: (state) => {
        this.opts.onPlayerState?.(camera.id, state);
        this.opts.onActiveCount?.(this.activeCount);
      },
    });
    this.players.set(camera.id, player);
    player.start();
  }

  startAll(): void {
    for (const camera of this.opts.cameras) this.startCamera(camera.id);
  }

  /** Tüm player'ları güvenli destroy edip (mod uygunsa) yeniden oluşturur. */
  refresh(): void {
    this.destroyAll();
    this.opts.onActiveCount?.(0);
    if (this.opts.mode.mode !== 'disabled') this.startAll();
  }

  destroyAll(): void {
    for (const player of this.players.values()) player.destroy();
    this.players.clear();
  }

  setMuted(muted: boolean): void {
    this.mutedState = muted;
    for (const camera of this.opts.cameras) {
      const video = this.opts.getVideo(camera.id);
      if (video) video.muted = muted;
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.mutedState);
    return this.mutedState;
  }

  private createDriver(camera: CameraConfig, index: number): CameraStreamDriver {
    this.debug.driversCreated++;
    const driver = this.opts.driverFactoryOverride
      ? this.opts.driverFactoryOverride(camera, index)
      : this.defaultDriver(index);
    this.debug.driversAlive++;
    const origDestroy = driver.destroy.bind(driver);
    let counted = true;
    driver.destroy = () => {
      if (counted) {
        counted = false;
        this.debug.driversAlive--;
      }
      origDestroy();
    };
    return driver;
  }

  private defaultDriver(index: number): CameraStreamDriver {
    const { mode, liveCount } = this.opts.mode;
    switch (mode) {
      case 'mock-loading':
        return new FakeCameraDriver({ scenario: 'loading', scheduler: this.opts.scheduler });
      case 'mock-offline':
        return new FakeCameraDriver({ scenario: 'offline', scheduler: this.opts.scheduler });
      case 'mock-live':
        return new FakeCameraDriver({
          scenario: index < liveCount ? 'live' : 'offline',
          scheduler: this.opts.scheduler,
        });
      case 'live':
        // hls.js kütüphanesi HlsCameraDriver.attach() içinde dynamic import edilir;
        // driver sınıfının kendisi ağ isteği/HLS başlatması içermez.
        return new HlsCameraDriver();
      default:
        throw new Error('disabled modda driver oluşturulamaz');
    }
  }
}
