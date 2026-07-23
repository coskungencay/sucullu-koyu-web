/**
 * Asset bütünlük doğrulaması: assets-manifest.json'daki SHA-256 değerlerini
 * diskteki dosyalarla karşılaştırır. Fark varsa exit 1.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(ROOT, 'assets-manifest.json'), 'utf8'));

let failures = 0;
for (const asset of manifest.assets) {
  const path = join(ROOT, asset.localPath);
  let actual;
  try {
    actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  } catch {
    console.error(`EKSİK: ${asset.localPath}`);
    failures++;
    continue;
  }
  if (actual !== asset.sha256) {
    console.error(`HASH FARKI: ${asset.localPath}`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`${failures}/${manifest.assets.length} dosya doğrulanamadı`);
  process.exit(1);
}
console.log(`OK: ${manifest.assets.length} dosyanın tamamı SHA-256 ile doğrulandı`);
