/**
 * Deploy sonrası staging doğrulaması.
 *
 * Kullanım: node scripts/staging-smoke.mjs --base https://<staging-domain> [--shots <dir>]
 *
 * Kontroller: healthz/rotalar, title/meta, 13 section, galeri 12→53, lightbox,
 * video öznitelikleri, kamera kartları/duvarı, disabled modda sıfır kamera
 * isteği, security headers, 404, console error, kırık first-party asset.
 * Opsiyonel: 1440×900 + 390×844 screenshot (harita/kamera-grid maskeli).
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const base = args[args.indexOf('--base') + 1];
const shotsIdx = args.indexOf('--shots');
const shotsDir = shotsIdx >= 0 ? args[shotsIdx + 1] : null;
if (!base || !base.startsWith('https://')) {
  console.error('kullanım: --base https://<staging-domain> (HTTPS zorunlu)');
  process.exit(1);
}
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

let failures = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
};

// --- HTTP düzeyi ---
async function head(path) {
  const res = await fetch(base + path, { method: 'GET', redirect: 'manual' });
  return res;
}
const health = await head('/healthz');
check('healthz 200', health.status === 200);
const home = await head('/');
check('/ 200', home.status === 200);
check('canli-kamera 200', (await head('/canli-kamera.html')).status === 200);
check('bilinmeyen rota 404', (await head('/olmayan-sayfa-xyz')).status === 404);
const headers = home.headers;
check('CSP header', (headers.get('content-security-policy') ?? '').includes("script-src 'self'"));
check('nosniff', headers.get('x-content-type-options') === 'nosniff');
check('referrer-policy', Boolean(headers.get('referrer-policy')));
check('permissions-policy', Boolean(headers.get('permissions-policy')));
const range = await fetch(base + '/gorseller/tanitim-video.mp4', {
  headers: { Range: 'bytes=0-1023' },
});
check('video range 206', range.status === 206);

// --- Tarayıcı düzeyi ---
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-gpu'] });
const consoleErrors = [];
const brokenAssets = [];
const cameraRequests = [];

async function newPage(width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 120));
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(base)) brokenAssets.push(`${r.status()} ${r.url()}`);
  });
  page.on('request', (r) => {
    if (r.url().includes('m3u8') || r.url().includes('kameraizle')) cameraRequests.push(r.url());
  });
  return { ctx, page };
}

{
  const { ctx, page } = await newPage(1440, 900);
  await page.goto(base + '/', { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  check('title', (await page.title()) === 'Sücüllü Köyü | Yalvaç / Isparta');
  const desc = await page
    .locator('meta[name="description"]')
    .getAttribute('content');
  check('meta description', (desc ?? '').startsWith('Sücüllü Köyü - Isparta ili'));
  const ids = await page.$$eval('section[id]', (els) => els.map((e) => e.id));
  check(
    '13 section (12 section + footer)',
    ids.join(',') ===
      'anasayfa,stats,hosgeldiniz,hakkimizda,tarihce,mahalleler,galeri,video,ekonomi,canli-kamera,konum' &&
      (await page.locator('footer#iletisim').count()) === 1,
    ids.join(','),
  );

  await page.locator('#galeri').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  check('galeri 12 görünür', (await page.locator('.gallery-item:not(.hidden)').count()) === 12);
  await page.locator('#loadMore').click();
  check('expand 53', (await page.locator('.gallery-item:not(.hidden)').count()) === 53);
  await page.locator('.gallery-item').first().click();
  await page.waitForTimeout(400);
  check('lightbox açıldı', await page.locator('.lightbox.active').isVisible());
  check(
    'lightbox sayaç 1/53',
    (await page.locator('.lightbox-counter').textContent()) === '1 / 53',
  );
  await page.keyboard.press('Escape');

  const video = page.locator('.video-wrapper video');
  check('video poster', (await video.getAttribute('poster')) === 'gorseller/hero.jpg');
  check('video controls', (await video.getAttribute('controls')) !== null);
  check(
    'video source',
    (await video.locator('source').getAttribute('src')) === 'gorseller/tanitim-video.mp4',
  );

  await page.locator('#canli-kamera').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  check('kamera 9 kart', (await page.locator('.camera-item').count()) === 9);
  check('maps iframe', await page.locator('.map-container iframe').isVisible());

  if (shotsDir) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2600);
    await page.screenshot({
      path: join(shotsDir, 'staging-home-1440x900-full.png'),
      fullPage: true,
      mask: [page.locator('.map-container'), page.locator('#cameraGrid')],
      maskColor: '#FF00FF',
    });
  }
  await ctx.close();
}

{
  const { ctx, page } = await newPage(390, 844);
  await page.goto(base + '/', { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2400);
  if (shotsDir) {
    await page.screenshot({ path: join(shotsDir, 'staging-home-390x844-hero.png') });
  }
  await ctx.close();
}

{
  const { ctx, page } = await newPage(1440, 900);
  await page.goto(base + '/canli-kamera.html', { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(1500);
  check('duvar 9 hücre', (await page.locator('.camera-cell').count()) === 9);
  check('duvar 0/9 AKTİF', (await page.locator('#camCount').textContent()) === '0/9 AKTİF');
  if (shotsDir) {
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none !important}' });
    await page.screenshot({
      path: join(shotsDir, 'staging-wall-1440x900.png'),
      mask: [page.locator('#clock')],
      maskColor: '#FF00FF',
    });
  }
  await ctx.close();
}

await browser.close();
check('console error 0', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
check('kırık first-party asset 0', brokenAssets.length === 0, brokenAssets.slice(0, 3).join(' | '));
check('kamera ağ isteği 0', cameraRequests.length === 0, cameraRequests.slice(0, 3).join(' | '));

console.log(failures === 0 ? '\nSTAGING SMOKE GEÇTİ' : `\n${failures} KONTROL BAŞARISIZ`);
process.exit(failures === 0 ? 0 : 1);
