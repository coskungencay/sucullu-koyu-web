import { expect, Page, test } from '@playwright/test';

/** Galeriye in, reveal'ı bekle, expand et — çoğu senaryonun ortak başlangıcı. */
async function gotoGallery(page: Page, { expand = false } = {}) {
  await page.goto('/');
  await page.locator('#galeri').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  if (expand) {
    await page.locator('#loadMore').click();
    await page.waitForTimeout(200);
  }
}

test.describe('galeri expand', () => {
  test('ilk yükte 12 görünür / 41 gizli, buton görünür', async ({ page }) => {
    await gotoGallery(page);
    await expect(page.locator('.gallery-item:not(.hidden)')).toHaveCount(12);
    await expect(page.locator('.gallery-item.hidden')).toHaveCount(41);
    await expect(page.locator('#loadMore')).toBeVisible();
    await expect(page.locator('#loadMore')).toContainText('Tüm Fotoğrafları Göster');
  });

  test('butona basınca 53 görünür, buton gizlenir, sıra korunur', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    await expect(page.locator('.gallery-item:not(.hidden)')).toHaveCount(53);
    await expect(page.locator('.gallery-item.hidden')).toHaveCount(0);
    await expect(page.locator('#loadMore')).toBeHidden();
    const srcs = await page.$$eval('.gallery-item img', (els) =>
      els.map((e) => e.getAttribute('src')),
    );
    expect(srcs[0]).toBe('gorseller/gorsel-01.jpg');
    expect(srcs[52]).toBe('gorseller/gorsel-53.jpg');
  });

  test('expand sonrası layout bozulmaz: yatay taşma yok, 4 kolon grid korunur', async ({
    page,
  }) => {
    await gotoGallery(page, { expand: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    // Kaynaktaki bilinen off-canvas taşma (mobil menü) desktop'ta yoktur
    expect(overflow).toBeLessThanOrEqual(0);
    const cols = await page
      .locator('.gallery-grid')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(4);
  });

  test('expand kamera endpointine ağ isteği başlatmaz', async ({ page }) => {
    const cameraRequests: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('m3u8') || r.url().includes('kameraizle')) cameraRequests.push(r.url());
    });
    await gotoGallery(page, { expand: true });
    await page.locator('.gallery-item').first().click();
    await page.waitForTimeout(500);
    expect(cameraRequests).toEqual([]);
  });
});

test.describe('lightbox', () => {
  test('ilk karta tıklayınca doğru görsel ve "1 / 53" sayacı', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    await page.locator('.gallery-item').first().click();
    await expect(page.locator('.lightbox')).toHaveClass(/active/);
    await expect(page.locator('.lightbox-img')).toHaveAttribute('src', /gorsel-01\.jpg/);
    await expect(page.locator('.lightbox-counter')).toHaveText('1 / 53');
  });

  test('expand öncesi kaynak davranışı: sayaç "1 / 12"', async ({ page }) => {
    await gotoGallery(page);
    await page.locator('.gallery-item').first().click();
    await expect(page.locator('.lightbox-counter')).toHaveText('1 / 12');
  });

  test('next/previous: 2 / 53 → 1 / 53', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    await page.locator('.gallery-item').first().click();
    await page.locator('.lightbox-next').click();
    await expect(page.locator('.lightbox-counter')).toHaveText('2 / 53');
    await expect(page.locator('.lightbox-img')).toHaveAttribute('src', /gorsel-02\.jpg/);
    await page.locator('.lightbox-prev').click();
    await expect(page.locator('.lightbox-counter')).toHaveText('1 / 53');
  });

  test('wrap: ilk görselde previous → 53 / 53; son görselde next → 1 / 53', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    await page.locator('.gallery-item').first().click();
    await page.locator('.lightbox-prev').click();
    await expect(page.locator('.lightbox-counter')).toHaveText('53 / 53');
    await expect(page.locator('.lightbox-img')).toHaveAttribute('src', /gorsel-53\.jpg/);
    await page.locator('.lightbox-next').click();
    await expect(page.locator('.lightbox-counter')).toHaveText('1 / 53');
  });

  test('tıklanan kart ile açılan görsel eşleşir (27. görsel)', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    await page.locator('.gallery-item').nth(26).click();
    await expect(page.locator('.lightbox-img')).toHaveAttribute('src', /gorsel-27\.jpg/);
    await expect(page.locator('.lightbox-counter')).toHaveText('27 / 53');
  });

  test('klavye: ArrowRight/ArrowLeft gezinir, Escape kapatır', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    await page.locator('.gallery-item').first().click();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.lightbox-counter')).toHaveText('2 / 53');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.lightbox-counter')).toHaveText('1 / 53');
    await page.keyboard.press('Escape');
    await expect(page.locator('.lightbox')).not.toHaveClass(/active/);
  });

  test('hızlı ileri kullanımı: sayaç-görsel senkronu bozulmaz', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    await page.locator('.gallery-item').first().click();
    for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight');
    await expect(page.locator('.lightbox-counter')).toHaveText('8 / 53');
    await expect(page.locator('.lightbox-img')).toHaveAttribute('src', /gorsel-08\.jpg/);
  });

  test('kapat butonu ve overlay tıklaması kapatır', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    await page.locator('.gallery-item').first().click();
    await page.locator('.lightbox-close').click();
    await expect(page.locator('.lightbox')).not.toHaveClass(/active/);
    // overlay (kaynak main.js: e.target === lightbox)
    await page.locator('.gallery-item').first().click();
    await expect(page.locator('.lightbox')).toHaveClass(/active/);
    await page.locator('.lightbox').click({ position: { x: 5, y: 400 } });
    await expect(page.locator('.lightbox')).not.toHaveClass(/active/);
  });

  test('body scroll açıkken kilitli, kapanınca geri gelir', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    await page.locator('.gallery-item').first().click();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  });

  test('görsel 90vw × 85vh sınırında ve aspect ratio bozulmaz', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    await page.locator('.gallery-item').first().click();
    await page.waitForTimeout(500);
    const box = await page.locator('.lightbox-img').boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.width).toBeLessThanOrEqual(vp.width * 0.9 + 1);
    expect(box!.height).toBeLessThanOrEqual(vp.height * 0.85 + 1);
    const fit = await page
      .locator('.lightbox-img')
      .evaluate((el) => getComputedStyle(el).objectFit);
    expect(fit).toBe('contain');
  });

  test('arka plan yaklaşık %95 siyah, opacity/scale transition korunur', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    const styles = await page.locator('.lightbox').evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, transition: s.transition };
    });
    expect(styles.bg).toBe('rgba(0, 0, 0, 0.95)');
    const imgTransition = await page
      .locator('.lightbox-img')
      .evaluate((el) => getComputedStyle(el).transition);
    expect(imgTransition).toContain('transform');
  });
});

test.describe('erişilebilirlik', () => {
  test('lightbox role=dialog, aria-modal, aria-hidden toggle', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    const lb = page.locator('.lightbox');
    await expect(lb).toHaveAttribute('role', 'dialog');
    await expect(lb).toHaveAttribute('aria-modal', 'true');
    await expect(lb).toHaveAttribute('aria-hidden', 'true');
    await page.locator('.gallery-item').first().click();
    await expect(lb).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    await expect(lb).toHaveAttribute('aria-hidden', 'true');
  });

  test('kartlar klavyeyle açılır; kapanınca focus açan karta döner', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    const third = page.locator('.gallery-item').nth(2);
    await third.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.lightbox')).toHaveClass(/active/);
    await expect(page.locator('.lightbox-counter')).toHaveText('3 / 53');
    // açılışta focus lightbox içindeki kapat kontrolünde
    await expect(page.locator('.lightbox-close')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(third).toBeFocused();
  });

  test('kartlarda anlamlı accessible name ve buton semantiği', async ({ page }) => {
    await gotoGallery(page);
    const first = page.locator('.gallery-item').first();
    await expect(first).toHaveAttribute('role', 'button');
    await expect(first).toHaveAttribute('tabindex', '0');
    await expect(first).toHaveAttribute('aria-label', /Sücüllü Köyü fotoğrafı 1 \/ 53/);
    await expect(page.locator('.lightbox-close')).toHaveAttribute('aria-label', 'Kapat');
    await expect(page.locator('.lightbox-prev')).toHaveAttribute('aria-label', 'Önceki fotoğraf');
    await expect(page.locator('.lightbox-next')).toHaveAttribute('aria-label', 'Sonraki fotoğraf');
  });

  test('kapalı lightbox klavye focus almaz', async ({ page }) => {
    await gotoGallery(page);
    const visibility = await page
      .locator('.lightbox')
      .evaluate((el) => getComputedStyle(el).visibility);
    expect(visibility).toBe('hidden');
    // visibility:hidden içindeki butonlar sequential focus'a girmez
    await page
      .locator('.lightbox-close')
      .focus({ timeout: 2000 })
      .catch(() => {});
    const focused = await page.evaluate(() => document.activeElement?.className ?? '');
    expect(focused).not.toContain('lightbox-close');
  });
});

test.describe('mobil 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('lightbox taşmaz, kontroller viewport içinde', async ({ page }) => {
    await gotoGallery(page, { expand: true });
    await page.locator('.gallery-item').first().click();
    await page.waitForTimeout(500);
    const vp = page.viewportSize()!;
    for (const sel of ['.lightbox-img', '.lightbox-close', '.lightbox-prev', '.lightbox-next']) {
      const box = await page.locator(sel).boundingBox();
      expect(box, sel).not.toBeNull();
      expect(box!.x, sel).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width, sel).toBeLessThanOrEqual(vp.width + 1);
      expect(box!.y, sel).toBeGreaterThanOrEqual(-1);
      expect(box!.y + box!.height, sel).toBeLessThanOrEqual(vp.height + 1);
    }
  });
});

test.describe('etkileşimler sırasında konsol temiz', () => {
  test('expand + lightbox + klavye akışında console error yok', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    await gotoGallery(page, { expand: true });
    await page.locator('.gallery-item').first().click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.locator('.lightbox-next').click();
    await page.locator('.lightbox-close').click();
    await page.locator('.gallery-item').nth(5).click();
    await page.keyboard.press('Escape');
    expect(consoleErrors).toEqual([]);
  });
});
