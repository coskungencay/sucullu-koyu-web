/**
 * Sprint 3 kamera golden'ları: ana sayfa kamera section durumları ve
 * kamera duvarı durumları. Kaynak ve clone AYNI prosedürle yakalanır.
 *
 * Determinizm önlemleri:
 * - CSS animasyonları her iki tarafta da dondurulur (spinner/pulse/blink
 *   fazı yakalama anına bağlı olduğundan) — animation: none.
 * - Duvarda #clock dinamik alan olarak maskelenir.
 * - Kaynak duvarın settled offline durumuna oturması için uzun bekleme uygulanır.
 *
 * Kullanım:
 *   node scripts/capture-camera.mjs --base https://www.sucullukoyu.com --out reference/screenshots/camera/source
 *   node scripts/capture-camera.mjs --base http://localhost:4173 --out reference/screenshots/camera/clone --clone-extras
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const base = args[args.indexOf('--base') + 1];
const out = args[args.indexOf('--out') + 1];
const cloneExtras = args.includes('--clone-extras');
if (!base || !out) {
  console.error('kullanım: --base <url> --out <dir> [--clone-extras]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const FREEZE_CSS = `*, *::before, *::after { animation: none !important; }`;
const WALL_SETTLE_MS = 20000;
const MASK_COLOR = '#FF00FF';

const WALL_VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x800', width: 360, height: 800 },
];

async function newPage(browser, width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  });
  return { ctx, page: await ctx.newPage() };
}

async function settleFonts(page) {
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
}

async function freeze(page) {
  await page.addStyleTag({ content: FREEZE_CSS });
}

const browser = await chromium.launch();

// ============ ANA SAYFA KAMERA SECTION (1440×900) ============
{
  const { ctx, page } = await newPage(browser, 1440, 900);
  await page.goto(base + '/', { waitUntil: 'load', timeout: 90000 });
  await settleFonts(page);
  await page.waitForTimeout(2400);
  await page.locator('#canli-kamera').scrollIntoViewIfNeeded();
  // Kaynakta HLS deneme dalgasının oturması için bekle (clone'da da aynı süre)
  await page.waitForTimeout(6000);
  await freeze(page);
  const section = page.locator('#canli-kamera');
  await section.screenshot({ path: join(out, 'home-camera-section-1440x900.png') });

  await page.locator('.camera-item').first().hover();
  await page.waitForTimeout(500);
  await section.screenshot({ path: join(out, 'home-camera-card-hover-1440x900.png') });

  await page.locator('.btn-camera-full').hover();
  await page.waitForTimeout(500);
  await page
    .locator('.camera-fullscreen-btn')
    .screenshot({ path: join(out, 'home-camera-cta-hover-1440x900.png') });
  await ctx.close();
  console.log('[home] kamera section + hover golden’ları alındı');
}

// ============ KAMERA DUVARI — OFFLINE (4 viewport) ============
for (const vp of WALL_VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp.width, vp.height);
  await page.goto(base + '/canli-kamera.html', { waitUntil: 'load', timeout: 90000 });
  await settleFonts(page);
  await page.waitForTimeout(WALL_SETTLE_MS);
  await freeze(page);
  await page.screenshot({
    path: join(out, `wall-offline-${vp.name}.png`),
    mask: [page.locator('#clock')],
    maskColor: MASK_COLOR,
  });
  await ctx.close();
  console.log(`[wall] offline ${vp.name} alındı`);
}

// ============ KAMERA DUVARI — ETKİLEŞİMLER (1440×900) ============
{
  const { ctx, page } = await newPage(browser, 1440, 900);
  await page.goto(base + '/canli-kamera.html', { waitUntil: 'load', timeout: 90000 });
  await settleFonts(page);
  await page.waitForTimeout(WALL_SETTLE_MS);
  await freeze(page);

  // Tek hücre büyütülmüş
  await page.locator('#cell-0').click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(out, 'wall-cell-zoom-1440x900.png'),
    mask: [page.locator('#clock')],
    maskColor: MASK_COLOR,
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Alt bar görünür (tıklama/mousemove sonrası)
  await page.mouse.move(720, 850);
  await page.waitForTimeout(500);
  await page.screenshot({
    path: join(out, 'wall-bottombar-visible-1440x900.png'),
    mask: [page.locator('#clock')],
    maskColor: MASK_COLOR,
  });

  // Mute active durumu
  await page.locator('#muteBtn').click();
  await page.waitForTimeout(300);
  await page.mouse.move(720, 840);
  await page.waitForTimeout(200);
  await page.screenshot({
    path: join(out, 'wall-mute-active-1440x900.png'),
    mask: [page.locator('#clock')],
    maskColor: MASK_COLOR,
  });
  await ctx.close();
  console.log('[wall] zoom + bottombar + mute golden’ları alındı');
}

// ============ CLONE-ONLY: MOCK MODLARI ============
if (cloneExtras) {
  const scenarios = [
    { q: '?cam=mock-loading', name: 'wall-mock-loading-1440x900' },
    { q: '?cam=mock-live', name: 'wall-mock-live-1440x900' },
    { q: '?cam=mock-live&live=3', name: 'wall-mock-live-3of9-1440x900' },
  ];
  for (const sc of scenarios) {
    const { ctx, page } = await newPage(browser, 1440, 900);
    await page.goto(base + '/canli-kamera.html' + sc.q, { waitUntil: 'load', timeout: 90000 });
    await settleFonts(page);
    await page.waitForTimeout(1500);
    await freeze(page);
    await page.screenshot({
      path: join(out, `${sc.name}.png`),
      mask: [page.locator('#clock')],
      maskColor: MASK_COLOR,
    });
    await ctx.close();
    console.log(`[wall] ${sc.name} alındı (clone-only)`);
  }

  // Ana sayfa mock durumları (clone-only)
  for (const sc of [
    { q: '/?cam=mock-offline', name: 'home-camera-offline-1440x900' },
    { q: '/?cam=mock-live', name: 'home-camera-live-1440x900' },
  ]) {
    const { ctx, page } = await newPage(browser, 1440, 900);
    await page.goto(base + sc.q, { waitUntil: 'load', timeout: 90000 });
    await settleFonts(page);
    await page.waitForTimeout(2400);
    await page.locator('#canli-kamera').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await freeze(page);
    await page.locator('#canli-kamera').screenshot({ path: join(out, `${sc.name}.png`) });
    await ctx.close();
    console.log(`[home] ${sc.name} alındı (clone-only)`);
  }
}

await browser.close();
console.log('camera goldens →', out);
