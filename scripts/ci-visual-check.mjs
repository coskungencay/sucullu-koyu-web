/**
 * CI görsel regresyon kapısı: repodaki ONAYLI kaynak golden'larına karşı
 * (reference/screenshots/source) clone'u yakalar ve belgeli eşiklerle
 * karşılaştırır. Kaynak canlı site CI'da YENİDEN SCRAPE EDİLMEZ.
 *
 * Eşikler (docs/VISUAL_PARITY.md ile uyumlu, macOS runner içindir):
 * - Section screenshot'ları: ≤ %0.35
 * - Hero (viewport): ≤ %0.60
 * - Full-page: ≤ %1.80 (background-attachment: fixed stitching artefakt
 *   bandı belgelidir; kod değişmeden ±%0.5 oynar)
 *
 * Golden güncelleme BİLİNÇLİ ve ayrı bir işlemdir (capture-source-reference);
 * bu script asla golden yazmaz.
 *
 * Kullanım: node scripts/ci-visual-check.mjs --base http://localhost:4173
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const base = args[args.indexOf('--base') + 1];
if (!base) {
  console.error('kullanım: --base <url>');
  process.exit(1);
}

const GOLDEN_DIR = join(ROOT, 'reference/screenshots/source');
const THRESHOLDS = [
  { pattern: /^section-/, maxPct: 0.35 },
  { pattern: /-hero\.png$/, maxPct: 0.6 },
  { pattern: /-full\.png$/, maxPct: 1.8 },
];

const captureDir = mkdtempSync(join(tmpdir(), 'ci-visual-'));
console.log('clone yakalanıyor →', captureDir);
execFileSync(
  'node',
  [join(ROOT, 'scripts/capture-source-reference.mjs'), '--base', base, '--out', captureDir],
  { stdio: 'inherit' },
);

let failures = 0;
for (const file of readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.png'))) {
  const rule = THRESHOLDS.find((t) => t.pattern.test(file));
  if (!rule) continue;
  let a, b;
  try {
    a = PNG.sync.read(readFileSync(join(GOLDEN_DIR, file)));
    b = PNG.sync.read(readFileSync(join(captureDir, file)));
  } catch {
    console.error(`FAIL ${file}: clone yakalaması eksik`);
    failures++;
    continue;
  }
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const crop = (img) => {
    const out = new PNG({ width, height });
    PNG.bitblt(img, out, 0, 0, width, height, 0, 0);
    return out;
  };
  const mismatch = pixelmatch(crop(a).data, crop(b).data, null, width, height, {
    threshold: 0.1,
  });
  const pct = (mismatch / (width * height)) * 100;
  const ok = pct <= rule.maxPct;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${file}\t${pct.toFixed(3)}% (eşik ${rule.maxPct}%)`);
  if (!ok) failures++;
}

if (failures > 0) {
  console.error(`\n${failures} görsel eşik aşımı — golden'lar otomatik GÜNCELLENMEZ.`);
  process.exit(1);
}
console.log('\nGörsel regresyon kapısı geçti.');
