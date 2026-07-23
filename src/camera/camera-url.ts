/**
 * Kamera URL güvenliği.
 *
 * Kurallar (CTO Sprint 3):
 * - Base URL yoksa null / missing-base-url.
 * - Yalnızca HTTPS (dev kolaylığı için yalnızca localhost'a HTTP izni opsiyonel).
 * - URL içinde kullanıcı adı/parola reddedilir.
 * - Base URL'de query/hash taşınamaz.
 * - Stream path sıkı biçimde doğrulanır (path traversal, slash, percent yok).
 * - Hata mesajları asla ham URL/secret içermez.
 */

export type BaseUrlValidation =
  | { ok: true; baseUrl: string }
  | { ok: false; reason: 'missing-base-url' | 'invalid-base-url' };

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const STREAM_PATH_RE = /^[a-z0-9_-]{1,64}$/i;

export function validateCameraBaseUrl(
  raw: string | undefined | null,
  opts: { allowInsecureLocalhost?: boolean } = {},
): BaseUrlValidation {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { ok: false, reason: 'missing-base-url' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'invalid-base-url' };
  }

  const httpsOk = url.protocol === 'https:';
  const localhostHttpOk =
    opts.allowInsecureLocalhost === true &&
    url.protocol === 'http:' &&
    LOCALHOST_HOSTS.has(url.hostname);
  if (!httpsOk && !localhostHttpOk) return { ok: false, reason: 'invalid-base-url' };

  if (url.username || url.password) return { ok: false, reason: 'invalid-base-url' };
  if (url.search || url.hash) return { ok: false, reason: 'invalid-base-url' };

  const path = url.pathname.replace(/\/+$/, '');
  return { ok: true, baseUrl: `${url.protocol}//${url.host}${path}` };
}

export function isValidStreamPath(streamPath: string): boolean {
  return STREAM_PATH_RE.test(streamPath);
}

/**
 * {baseUrl}/{streamPath}/index.m3u8 üretir; geçersiz girişte null.
 * baseUrl'in validateCameraBaseUrl'den geçmiş olması beklenir; yine de
 * savunmacı olarak yeniden doğrulanır.
 */
export function buildManifestUrl(
  baseUrl: string,
  streamPath: string,
  opts: { allowInsecureLocalhost?: boolean } = {},
): string | null {
  const validated = validateCameraBaseUrl(baseUrl, opts);
  if (!validated.ok) return null;
  if (!isValidStreamPath(streamPath)) return null;
  return `${validated.baseUrl}/${streamPath}/index.m3u8`;
}
