/**
 * Windows kamera relay paketini dağıtıma hazır ZIP olarak üretir.
 * Kullanım: node scripts/build-relay-zip.mjs
 * Çıktı: dist-tools/sucullu-kamera-relay.zip
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'tools', 'windows-camera-relay');
const OUT_DIR = join(ROOT, 'dist-tools');
const OUT_ZIP = join(OUT_DIR, 'sucullu-kamera-relay.zip');

if (!existsSync(SRC)) {
  console.error('kaynak bulunamadı:', SRC);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
rmSync(OUT_ZIP, { force: true });

// logs/state icerigi ve gercek config.env pakete girmez.
execFileSync(
  'zip',
  [
    '-r',
    OUT_ZIP,
    'windows-camera-relay',
    '-x',
    'windows-camera-relay/logs/*',
    'windows-camera-relay/state/*',
    'windows-camera-relay/config.env',
    'windows-camera-relay/ffmpeg/*',
  ],
  { cwd: join(ROOT, 'tools'), stdio: 'inherit' },
);
console.log('ZIP hazır →', OUT_ZIP);
