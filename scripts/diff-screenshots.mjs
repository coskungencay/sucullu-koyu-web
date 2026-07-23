/**
 * Kaynak-clone görsel diff raporu (pixelmatch).
 *
 * Kullanım: node scripts/diff-screenshots.mjs
 * reference/screenshots/source ve .../clone içindeki aynı adlı PNG'leri
 * karşılaştırır, .../diff altına fark görselini ve konsola oranları yazar.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'reference/screenshots/source');
const CLONE = join(ROOT, 'reference/screenshots/clone');
const DIFF = join(ROOT, 'reference/screenshots/diff');
mkdirSync(DIFF, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.endsWith('.png'));
const rows = [];

for (const f of files) {
  let a, b;
  try {
    a = PNG.sync.read(readFileSync(join(SRC, f)));
    b = PNG.sync.read(readFileSync(join(CLONE, f)));
  } catch {
    rows.push({ file: f, status: 'EKSİK' });
    continue;
  }
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const crop = (img) => {
    const out = new PNG({ width, height });
    PNG.bitblt(img, out, 0, 0, width, height, 0, 0);
    return out;
  };
  const ca = crop(a);
  const cb = crop(b);
  const diff = new PNG({ width, height });
  const mismatch = pixelmatch(ca.data, cb.data, diff.data, width, height, { threshold: 0.1 });
  const pct = (mismatch / (width * height)) * 100;
  writeFileSync(join(DIFF, f), PNG.sync.write(diff));
  rows.push({
    file: f,
    status: 'OK',
    pct: pct.toFixed(3),
    sizeNote:
      a.width !== b.width || a.height !== b.height
        ? `boyut ${a.width}x${a.height} vs ${b.width}x${b.height}`
        : '',
  });
}

for (const r of rows) {
  console.log(r.status === 'OK' ? `${r.file}\t${r.pct}%\t${r.sizeNote}` : `${r.file}\t${r.status}`);
}
