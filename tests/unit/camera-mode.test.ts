import { describe, expect, it } from 'vitest';
import { resolveCameraMode } from '../../src/camera/camera-mode';

describe('kamera modu çözümleme', () => {
  it('varsayılan disabled (base URL yok)', () => {
    const r = resolveCameraMode({ baseUrlRaw: '', search: '' });
    expect(r.mode).toBe('disabled');
    expect(r.offlineReason).toBe('missing-base-url');
  });

  it('geçerli HTTPS base → live', () => {
    const r = resolveCameraMode({ baseUrlRaw: 'https://example.test', search: '' });
    expect(r.mode).toBe('live');
    expect(r.baseUrl).toBe('https://example.test');
  });

  it('geçersiz base → disabled/invalid-base-url (live moda güvenli düşüş)', () => {
    const r = resolveCameraMode({ baseUrlRaw: 'http://example.test', search: '' });
    expect(r.mode).toBe('disabled');
    expect(r.offlineReason).toBe('invalid-base-url');
  });

  it('whitelist mock modları kabul edilir ve base URL taşımaz', () => {
    expect(resolveCameraMode({ search: '?cam=mock-loading' }).mode).toBe('mock-loading');
    expect(resolveCameraMode({ search: '?cam=mock-offline' }).mode).toBe('mock-offline');
    const live = resolveCameraMode({ search: '?cam=mock-live' });
    expect(live.mode).toBe('mock-live');
    expect(live.liveCount).toBe(9);
    expect(live.baseUrl).toBe('');
  });

  it('bilinmeyen query değeri → disabled (live dahil!)', () => {
    expect(resolveCameraMode({ search: '?cam=hacked' }).mode).toBe('disabled');
    expect(resolveCameraMode({ search: '?cam=live' }).mode).toBe('disabled');
    expect(resolveCameraMode({ search: '?cam=' }).mode).toBe('disabled');
  });

  it('query, geçerli base URL varken bile live moda geçiremez; mock override edebilir', () => {
    const r = resolveCameraMode({
      baseUrlRaw: 'https://example.test',
      search: '?cam=mock-offline',
    });
    expect(r.mode).toBe('mock-offline');
    expect(r.baseUrl).toBe('');
  });

  it('mock-live live parametresi 0-9 doğrulanır; geçersizde 9', () => {
    expect(resolveCameraMode({ search: '?cam=mock-live&live=3' }).liveCount).toBe(3);
    expect(resolveCameraMode({ search: '?cam=mock-live&live=0' }).liveCount).toBe(0);
    expect(resolveCameraMode({ search: '?cam=mock-live&live=9' }).liveCount).toBe(9);
    expect(resolveCameraMode({ search: '?cam=mock-live&live=99' }).liveCount).toBe(9);
    expect(resolveCameraMode({ search: '?cam=mock-live&live=-1' }).liveCount).toBe(9);
    expect(resolveCameraMode({ search: '?cam=mock-live&live=abc' }).liveCount).toBe(9);
  });
});
