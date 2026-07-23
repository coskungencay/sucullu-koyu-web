import { describe, expect, it } from 'vitest';
import {
  buildManifestUrl,
  isValidStreamPath,
  validateCameraBaseUrl,
} from '../../src/camera/camera-url';

describe('base URL doğrulaması', () => {
  it('boş/undefined → missing-base-url', () => {
    expect(validateCameraBaseUrl('')).toEqual({ ok: false, reason: 'missing-base-url' });
    expect(validateCameraBaseUrl('   ')).toEqual({ ok: false, reason: 'missing-base-url' });
    expect(validateCameraBaseUrl(undefined)).toEqual({ ok: false, reason: 'missing-base-url' });
  });

  it('yalnızca HTTPS kabul edilir; http reddedilir', () => {
    expect(validateCameraBaseUrl('https://example.test')).toEqual({
      ok: true,
      baseUrl: 'https://example.test',
    });
    expect(validateCameraBaseUrl('http://example.test')).toEqual({
      ok: false,
      reason: 'invalid-base-url',
    });
  });

  it('http yalnızca opsiyonel localhost izniyle kabul edilir', () => {
    expect(
      validateCameraBaseUrl('http://localhost:8080', { allowInsecureLocalhost: true }).ok,
    ).toBe(true);
    expect(validateCameraBaseUrl('http://evil.test', { allowInsecureLocalhost: true }).ok).toBe(
      false,
    );
  });

  it('credential içeren URL reddedilir', () => {
    expect(validateCameraBaseUrl('https://user:pass@example.test').ok).toBe(false);
    expect(validateCameraBaseUrl('https://user@example.test').ok).toBe(false);
  });

  it('query/hash taşıyan base reddedilir', () => {
    expect(validateCameraBaseUrl('https://example.test?token=x').ok).toBe(false);
    expect(validateCameraBaseUrl('https://example.test#x').ok).toBe(false);
  });

  it('geçersiz URL reddedilir ve hata nedeninde ham URL bulunmaz', () => {
    const result = validateCameraBaseUrl('not-a-url');
    expect(result).toEqual({ ok: false, reason: 'invalid-base-url' });
  });

  it('path normalize edilir (sondaki slash kırpılır, alt path korunur)', () => {
    expect(validateCameraBaseUrl('https://example.test/hls/')).toEqual({
      ok: true,
      baseUrl: 'https://example.test/hls',
    });
  });
});

describe('stream path doğrulaması', () => {
  it('geçerli path desenleri', () => {
    expect(isValidStreamPath('kamera1')).toBe(true);
    expect(isValidStreamPath('p850')).toBe(true);
    expect(isValidStreamPath('cam_2-a')).toBe(true);
  });

  it('path traversal ve tehlikeli karakterler reddedilir', () => {
    expect(isValidStreamPath('..')).toBe(false);
    expect(isValidStreamPath('../etc')).toBe(false);
    expect(isValidStreamPath('a/b')).toBe(false);
    expect(isValidStreamPath('a%2e%2e')).toBe(false);
    expect(isValidStreamPath('a?x=1')).toBe(false);
    expect(isValidStreamPath('')).toBe(false);
    expect(isValidStreamPath('a'.repeat(65))).toBe(false);
  });
});

describe('manifest URL üretimi', () => {
  it('kalıp: {baseUrl}/{streamPath}/index.m3u8', () => {
    expect(buildManifestUrl('https://example.test', 'kamera1')).toBe(
      'https://example.test/kamera1/index.m3u8',
    );
    expect(buildManifestUrl('https://example.test/hls/', 'p850')).toBe(
      'https://example.test/hls/p850/index.m3u8',
    );
  });

  it('geçersiz base veya path → null (ağ isteği yapılmamalı)', () => {
    expect(buildManifestUrl('', 'kamera1')).toBeNull();
    expect(buildManifestUrl('http://example.test', 'kamera1')).toBeNull();
    expect(buildManifestUrl('https://u:p@example.test', 'kamera1')).toBeNull();
    expect(buildManifestUrl('https://example.test', '../secret')).toBeNull();
  });
});
