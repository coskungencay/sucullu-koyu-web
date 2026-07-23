/**
 * Kaynak/clone screenshot matrisi.
 *
 * Kullanım:
 *   node scripts/capture-source-reference.mjs --base https://www.sucullukoyu.com --out reference/screenshots/source
 *   node scripts/capture-source-reference.mjs --base http://localhost:4173 --out reference/screenshots/clone
 *
 * Davranış: fontlar + hero animasyonu settle olana kadar bekler, sayfayı
 * kademeli kaydırarak reveal/counter animasyonlarını tetikler, başa döner ve
 * settled full-page + section screenshot'ları alır. Dinamik alanlar
 * (Google Maps, kamera grid) sabit renkle maskelenir.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const base = args[args.indexOf('--base') + 1];
const out = args[args.indexOf('--out') + 1];
if (!base || !out) {
  console.error('kullanım: --base <url> --out <dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x800', width: 360, height: 800 },
];

const SECTIONS = [
  'stats',
  'hosgeldiniz',
  'hakkimizda',
  'tarihce',
  'mahalleler',
  'galeri',
  'video',
  'ekonomi',
  'canli-kamera',
  'konum',
  'iletisim',
];

const MASK_COLOR = '#FF00FF';

async function settle(page) {
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  // Hero fadeUp zinciri (son öğe 1s gecikme + 1s animasyon)
  await page.waitForTimeout(2400);
  // Kademeli kaydırma: reveal + lazy image + sayaçları tetikle
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  // Sayaç (2s) + reveal (0.8s) animasyonlarının bitmesini bekle
  await page.waitForTimeout(2600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
}

// Determinizm: sRGB profili + GPU kapalı (SwiftShader). GPU'lu makine ile
// GPU'suz CI runner'ı fotoğraf küçültmeyi farklı resample eder; yazılım
// rasterizer'ı her ortamda bit-eşdeğer sonuç verir.
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-gpu'] });
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(base + '/', { waitUntil: 'load', timeout: 90000 });
  await settle(page);

  const mask = [page.locator('.map-container'), page.locator('#cameraGrid')];
  const maskColor = MASK_COLOR;

  await page.screenshot({
    path: join(out, `home-${vp.name}-full.png`),
    fullPage: true,
    mask,
    maskColor,
  });
  await page.screenshot({ path: join(out, `home-${vp.name}-hero.png`) });

  if (vp.name === '1440x900' || vp.name === '390x844') {
    for (const id of SECTIONS) {
      const el = page.locator(`#${id}`);
      if ((await el.count()) === 0) continue;
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await el.screenshot({ path: join(out, `section-${id}-${vp.name}.png`), mask, maskColor });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  if (errors.length) {
    console.log(`[${vp.name}] console errors (${errors.length}):`);
    errors.slice(0, 5).forEach((e) => console.log('  ' + e.slice(0, 160)));
  } else {
    console.log(`[${vp.name}] console temiz`);
  }
  await context.close();
}
await browser.close();
console.log('screenshots →', out);
