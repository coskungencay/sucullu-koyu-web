export type CameraConfig = {
  id: string;
  streamPath: string;
  homeOrder: number;
  wallOrder: number;
  homeLabel: string;
  wallLabel: string;
  enabled: boolean;
};

/** Kamera çalışma modu. Varsayılan disabled; live yalnızca geçerli HTTPS base URL ile. */
export type CameraMode = 'disabled' | 'mock-loading' | 'mock-offline' | 'mock-live' | 'live';

export type CameraOfflineReason =
  | 'disabled'
  | 'missing-base-url'
  | 'invalid-base-url'
  | 'manifest-error'
  | 'network-error'
  | 'media-error'
  | 'retry-exhausted'
  | 'unsupported'
  | 'destroyed';

export type CameraPlayerState =
  | { status: 'idle' }
  | { status: 'loading'; attempt: number }
  | { status: 'playing'; startedAt: number }
  | { status: 'stalled'; lastProgressAt: number }
  | { status: 'retry-wait'; attempt: number; retryAt: number }
  | { status: 'offline'; reason: CameraOfflineReason }
  | { status: 'destroyed' };

export type CameraDriverErrorKind = 'network' | 'media' | 'manifest' | 'unsupported';

export type CameraDriverEvent = 'playing' | 'error';

export type CameraDriverErrorPayload = { kind: CameraDriverErrorKind };

export type CameraDriverHandler = (payload?: CameraDriverErrorPayload) => void;

export type Unsubscribe = () => void;

/** Player ile HLS.js'i ayrıştıran sürücü arayüzü (HlsCameraDriver / FakeCameraDriver). */
export interface CameraStreamDriver {
  attach(video: HTMLVideoElement, url: string): Promise<void>;
  start(): void;
  stop(): void;
  destroy(): void;
  on(event: CameraDriverEvent, handler: CameraDriverHandler): Unsubscribe;
}

/** Zaman kaynakları dependency injection ile test edilebilir. */
export type Scheduler = {
  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout>;
  clearTimeout(id: ReturnType<typeof setTimeout>): void;
  setInterval(fn: () => void, ms: number): ReturnType<typeof setInterval>;
  clearInterval(id: ReturnType<typeof setInterval>): void;
};
