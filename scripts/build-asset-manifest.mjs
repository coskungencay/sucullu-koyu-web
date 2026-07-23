/**
 * Sprint 0 — Medya varlığı dondurma manifesti üretici.
 * public/gorseller altındaki snapshot dosyaları için kaynak URL, MIME,
 * byte, boyut/metadata ve SHA-256 kaydeder. Orijinal dosyalara yazmaz.
 *
 * Kullanım: node scripts/build-asset-manifest.mjs
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIR = join(ROOT, 'public', 'gorseller');
const SOURCE_BASE = 'https://sucullukoyu.com/gorseller';

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function imageDims(path) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path], {
    encoding: 'utf8',
  });
  const w = /pixelWidth: (\d+)/.exec(out)?.[1];
  const h = /pixelHeight: (\d+)/.exec(out)?.[1];
  return { width: Number(w), height: Number(h) };
}

function videoMeta(path) {
  const out = execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,codec_name',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      path,
    ],
    { encoding: 'utf8' },
  );
  const j = JSON.parse(out);
  return {
    width: j.streams[0].width,
    height: j.streams[0].height,
    codec: j.streams[0].codec_name,
    durationSeconds: Number(j.format.duration),
  };
}

const files = readdirSync(DIR)
  .filter((f) => !f.startsWith('.'))
  .sort();
const assets = files.map((name) => {
  const path = join(DIR, name);
  const bytes = statSync(path).size;
  const isVideo = name.endsWith('.mp4');
  return {
    sourceUrl: `${SOURCE_BASE}/${name}`,
    localPath: `public/gorseller/${name}`,
    mime: isVideo ? 'video/mp4' : 'image/jpeg',
    bytes,
    ...(isVideo ? { video: videoMeta(path) } : imageDims(path)),
    sha256: sha256(path),
  };
});

const manifest = {
  snapshotDate: process.env.SNAPSHOT_DATE ?? new Date().toISOString().slice(0, 10),
  sourceSite: 'https://www.sucullukoyu.com/',
  note: 'Tek seferlik forensic snapshot. Orijinal byte korunmustur; yeniden encode/sıkıştırma yapılmamıştır.',
  totalFiles: assets.length,
  totalBytes: assets.reduce((s, a) => s + a.bytes, 0),
  assets,
};

writeFileSync(join(ROOT, 'assets-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`assets-manifest.json yazıldı: ${assets.length} dosya, ${manifest.totalBytes} byte`);
