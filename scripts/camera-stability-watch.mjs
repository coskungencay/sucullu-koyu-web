/**
 * Kamera gateway stabilite izleme.
 *
 * Kullanım:
 *   node scripts/camera-stability-watch.mjs --base <gateway-url> --minutes 30 \
 *     --active kamera6,kamera5,... --offline kamera1,kamera2,...
 *
 * Her turda aktif yolların master manifestini, media playlist'ini ve
 * MEDIA-SEQUENCE ilerlemesini; offline yolların kontrollü 404'ünü doğrular.
 * Secret kullanmaz/yazmaz.
 */
const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};

const BASE = arg('--base', 'https://sucullu-koyu-camera.46.225.123.167.sslip.io');
const MINUTES = Number(arg('--minutes', '30'));
const ACTIVE = arg('--active', 'kamera6,kamera5,kamera7,kamera8,kamera10,p850').split(',');
const OFFLINE = arg('--offline', 'kamera1,kamera2,kamera11').split(',');
const INTERVAL_MS = 60_000;

// MediaMTX HLS'te cookieCheck yönlendirmesi var; query ile doğrudan geçilir.
const q = (u) => (u.includes('?') ? `${u}&cookieCheck=1` : `${u}?cookieCheck=1`);

async function fetchText(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(q(url), { signal: ctrl.signal, redirect: 'follow' });
    const body = res.ok ? await res.text() : '';
    return { status: res.status, body };
  } catch {
    return { status: 0, body: '' };
  } finally {
    clearTimeout(t);
  }
}

async function probe(path) {
  const master = await fetchText(`${BASE}/${path}/index.m3u8`);
  if (master.status !== 200) return { path, master: master.status, media: null, seq: null };
  const mediaName = master.body
    .split('\n')
    .map((l) => l.trim())
    // MediaMTX media playlist adı '?session=...' query'si taşır
    .find((l) => l && !l.startsWith('#') && l.includes('.m3u8'));
  if (!mediaName) return { path, master: 200, media: null, seq: null };
  const media = await fetchText(`${BASE}/${path}/${mediaName}`);
  const seqLine = media.body.split('\n').find((l) => l.startsWith('#EXT-X-MEDIA-SEQUENCE'));
  const seq = seqLine ? Number(seqLine.split(':')[1]) : null;
  const segments = media.body.split('\n').filter((l) => l.includes('.mp4')).length;
  return { path, master: 200, media: media.status, seq, segments };
}

const rounds = Math.max(1, Math.round((MINUTES * 60_000) / INTERVAL_MS));
const prevSeq = new Map();
const stats = new Map(ACTIVE.map((p) => [p, { ok: 0, fail: 0, advanced: 0, stalled: 0 }]));
let offlineViolations = 0;

console.log(`stabilite izleme basladi: ${rounds} tur x 60 sn (~${MINUTES} dk)`);
console.log(`aktif: ${ACTIVE.join(', ')}`);
console.log(`offline beklenen: ${OFFLINE.join(', ')}`);

for (let r = 1; r <= rounds; r++) {
  const ts = new Date().toISOString().slice(11, 19);
  // Sıralı: MediaMTX her HLS isteğinde yeni session açtığından eşzamanlı
  // sorgular birbirini boğuyor ve yanlış "fail" üretiyordu.
  const results = [];
  for (const p of ACTIVE) results.push(await probe(p));
  const parts = [];
  for (const res of results) {
    const st = stats.get(res.path);
    const healthy = res.master === 200 && res.media === 200;
    if (healthy) st.ok++;
    else st.fail++;
    const before = prevSeq.get(res.path);
    if (healthy && before !== undefined && res.seq !== null) {
      if (res.seq > before) st.advanced++;
      else st.stalled++;
    }
    if (res.seq !== null) prevSeq.set(res.path, res.seq);
    parts.push(`${res.path}:${healthy ? 'OK' : `${res.master}/${res.media}`}#${res.seq ?? '-'}`);
  }
  // Offline yollar kontrollü 404 dönmeli
  const offlineChecks = [];
  for (const p of OFFLINE) {
    offlineChecks.push({ p, s: (await fetchText(`${BASE}/${p}/index.m3u8`)).status });
  }
  const badOffline = offlineChecks.filter((o) => o.s === 200);
  if (badOffline.length) offlineViolations++;
  console.log(
    `[${ts}] tur ${r}/${rounds} | ${parts.join(' ')} | offline:${badOffline.length ? 'IHLAL' : 'ok'}`,
  );
  if (r < rounds) await new Promise((res) => setTimeout(res, INTERVAL_MS));
}

console.log('\n===== STABILITE OZETI =====');
let allGood = true;
for (const [p, s] of stats) {
  const line = `${p.padEnd(9)} saglikli:${s.ok}/${rounds}  segment-ilerledi:${s.advanced}  durdu:${s.stalled}`;
  console.log(line);
  if (s.fail > 0 || (s.stalled > 0 && s.advanced === 0)) allGood = false;
}
console.log(`offline yol ihlali: ${offlineViolations}`);
if (offlineViolations > 0) allGood = false;
console.log(allGood ? '\nSTABILITE: GECTI' : '\nSTABILITE: SORUN VAR');
process.exit(allGood ? 0 : 1);
