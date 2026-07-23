import type Hls from 'hls.js';
import { BaseCameraDriver } from './camera-driver';

/**
 * hls.js 1.4.12 (npm pin) tabanlı sürücü. Kütüphane YALNIZCA live modda,
 * attach() çağrıldığında dynamic import edilir; disabled/mock modlarda
 * bundle'a hiçbir HLS isteği/başlatması girmez.
 *
 * HLS config, kaynak ana sayfa istemcisinin doğrulanmış değerleridir.
 */
export class HlsCameraDriver extends BaseCameraDriver {
  private hls: Hls | null = null;
  private video: HTMLVideoElement | null = null;
  private url = '';
  private videoListeners: Array<[string, EventListener]> = [];

  async attach(video: HTMLVideoElement, url: string): Promise<void> {
    if (this.destroyed) return;
    this.video = video;
    this.url = url;

    const { default: HlsCtor } = await import('hls.js');
    if (this.destroyed) return;

    if (HlsCtor.isSupported()) {
      const hls = new HlsCtor({
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 3,
        maxBufferLength: 8,
        maxMaxBufferLength: 15,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 15000,
        levelLoadingMaxRetry: 6,
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        lowLatencyMode: false,
        backBufferLength: 0,
      });
      this.hls = hls;
      hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(HlsCtor.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
          const isManifest = String(data.details ?? '')
            .toLowerCase()
            .includes('manifest');
          this.emit('error', { kind: isManifest ? 'manifest' : 'network' });
        } else if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
          this.emit('error', { kind: 'media' });
        } else {
          this.emit('error', { kind: 'network' });
        }
      });
      this.addVideoListener('playing', () => this.emit('playing'));
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      this.addVideoListener('playing', () => this.emit('playing'));
      this.addVideoListener('error', () => this.emit('error', { kind: 'network' }));
    } else {
      this.emit('error', { kind: 'unsupported' });
    }
  }

  start(): void {
    if (this.destroyed || !this.video) return;
    if (this.hls) {
      this.hls.loadSource(this.url);
      this.hls.attachMedia(this.video);
    } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      this.video.src = this.url;
      this.video.play().catch(() => {});
    }
  }

  stop(): void {
    this.hls?.stopLoad();
  }

  private addVideoListener(event: string, handler: EventListener): void {
    this.video?.addEventListener(event, handler);
    this.videoListeners.push([event, handler]);
  }

  destroy(): void {
    if (this.destroyed) return;
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.video) {
      for (const [event, handler] of this.videoListeners) {
        this.video.removeEventListener(event, handler);
      }
      this.videoListeners = [];
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
      this.video = null;
    }
    super.destroy();
  }
}
