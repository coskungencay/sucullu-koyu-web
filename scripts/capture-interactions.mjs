/**
 * Sprint 2 interaction golden'ları: galeri expand, lightbox, hover, mobil menü,
 * navbar scrolled, video bölümü. Kaynak ve clone aynı prosedürle yakalanır;
 * galeri/lightbox alanları MASKELENMEZ (CTO Sprint 2 talimatı).
 *
 * Kullanım:
 *   node scripts/capture-interactions.mjs --base https://www.sucullukoyu.com --out reference/screenshots/interactions/source
 *   node scripts/capture-interactions.mjs --base http://localhost:4173 --out reference/screenshots/interactions/clone --clone-extras
 *
 * --clone-extras: yalnızca clone'da anlamlı olan focus-visible örneğini de üretir
 * (kaynakta galeri kartları odaklanabilir değildir).
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

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
];

async function waitForImages(page, selector) {
  await page
    .evaluate(async (sel) => {
      const imgs = Array.from(document.querySelectorAll(sel));
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise((r) => {
                img.addEventListener('load', r, { once: true });
                img.addEventListener('error', r, { once: true });
                setTimeout(r, 20000);
              }),
        ),
      );
    }, selector)
    .catch(() => {});
}

async function settleToGallery(page) {
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2400);
  await page.locator('#galeri').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  await waitForImages(page, '.gallery-item:not(.hidden) img');
}

async function openLightboxAt(page, index) {
  await page.locator('.gallery-item').nth(index).click();
  await page.waitForTimeout(500);
  await page
    .evaluate(async () => {
      const img = document.querySelector('.lightbox-img');
      if (img && !img.complete) {
        await new Promise((r) => {
          img.addEventListener('load', r, { once: true });
          img.addEventListener('error', r, { once: true });
          setTimeout(r, 20000);
        });
      }
    })
    .catch(() => {});
  await page.waitForTimeout(400);
}

// Renk profili sabitlenir: farklı makinelerde (CI runner dahil) display
// profili fotoğraf piksellerini kaydırır; sRGB zorlaması deterministik yapar.
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-gpu'] });
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  });
  const shot = (page, name, opts = {}) =>
    page.screenshot({ path: join(out, `${name}-${vp.name}.png`), ...opts });
  const isDesktop = vp.width >= 1024;

  // --- Galeri başlangıç + hover + navbar scrolled + video ---
  let page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load', timeout: 90000 });
  await settleToGallery(page);
  await page.locator('#galeri').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator('#galeri').screenshot({ path: join(out, `galeri-initial-${vp.name}.png`) });

  if (isDesktop) {
    await page.locator('.gallery-item').first().hover();
    await page.waitForTimeout(700);
    await page
      .locator('#galeri')
      .screenshot({ path: join(out, `galeri-card-hover-${vp.name}.png`) });
    await page.mouse.move(0, 0);
  }

  // Navbar scrolled (viewport üst şeridi) — şeride giren stats sayaçlarının
  // 2 sn'lik animasyonu bitene kadar beklenir (deterministik settled state).
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(2800);
  await shot(page, 'navbar-scrolled', { clip: { x: 0, y: 0, width: vp.width, height: 120 } });

  // Video bölümü
  await page.locator('#video').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.locator('#video').screenshot({ path: join(out, `video-section-${vp.name}.png`) });
  await page.close();

  // --- Expand + lightbox senaryoları ---
  page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load', timeout: 90000 });
  await settleToGallery(page);
  await page.locator('#loadMore').click();
  await page.waitForTimeout(600);
  await waitForImages(page, '.gallery-item img');
  await page.locator('#galeri').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator('#galeri').screenshot({ path: join(out, `galeri-expanded-${vp.name}.png`) });

  await openLightboxAt(page, 0);
  await shot(page, 'lightbox-first');
  if (isDesktop) {
    await page.locator('.lightbox-next').hover();
    await page.waitForTimeout(500);
    await shot(page, 'lightbox-nav-hover');
  } else {
    // Mobil kontrol şeridi: alt yarı (nav butonları + sayaç)
    await shot(page, 'lightbox-controls', {
      clip: {
        x: 0,
        y: Math.round(vp.height / 2),
        width: vp.width,
        height: Math.round(vp.height / 2),
      },
    });
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await openLightboxAt(page, 26);
  await shot(page, 'lightbox-middle');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await openLightboxAt(page, 52);
  await shot(page, 'lightbox-last');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.close();

  // --- Mobil menü ---
  if (!isDesktop) {
    page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'load', timeout: 90000 });
    await page.waitForLoadState('load');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2400);
    await page.locator('.hamburger').click();
    await page.waitForTimeout(600);
    await shot(page, 'mobile-menu-open');
    await page.close();
  }

  // --- Focus-visible örneği (yalnızca clone) ---
  if (cloneExtras && !isDesktop) {
    page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'load', timeout: 90000 });
    await settleToGallery(page);
    await page.keyboard.press('Tab'); // klavye modalitesi
    await page.evaluate(() => document.querySelector('.gallery-item')?.focus());
    await page.waitForTimeout(300);
    await page.locator('#galeri').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.locator('#galeri').screenshot({ path: join(out, `focus-visible-${vp.name}.png`) });
    await page.close();
  }

  await ctx.close();
  console.log(`[${vp.name}] interaction senaryoları tamam`);
}
await browser.close();
console.log('interactions →', out);
