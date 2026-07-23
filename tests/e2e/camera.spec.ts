import { expect, Page, test } from '@playwright/test';

/** Kamera isteklerini ve console hatalarını izleyen ortak kurulum. */
function watch(page: Page) {
  const cameraRequests: string[] = [];
  const consoleErrors: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('m3u8') || r.url().includes('kameraizle')) cameraRequests.push(r.url());
  });
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  return { cameraRequests, consoleErrors };
}

test.describe('ana sayfa kamera preview — mock modları', () => {
  test('mock-offline: kartlar Bağlantı Yok gösterir; sıfır kamera isteği', async ({ page }) => {
    const { cameraRequests, consoleErrors } = watch(page);
    await page.goto('/?cam=mock-offline');
    await page.locator('#canli-kamera').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await expect(page.locator('.camera-item .cam-offline').first()).toBeVisible();
    await expect(page.locator('.camera-item .cam-offline')).toHaveCount(9);
    expect(cameraRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('mock-loading: spinner kalıcı görünür', async ({ page }) => {
    await page.goto('/?cam=mock-loading');
    await page.locator('#canli-kamera').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await expect(page.locator('.camera-item .cam-loading').first()).toBeVisible();
    await expect(page.locator('.camera-item .cam-offline').first()).toBeHidden();
  });

  test('mock-live: CANLI tam opak, spinner gizli', async ({ page }) => {
    await page.goto('/?cam=mock-live');
    await page.locator('#canli-kamera').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    const liveOpacity = await page
      .locator('.camera-item .cam-live')
      .first()
      .evaluate((el) => el.style.opacity);
    expect(liveOpacity).toBe('1');
    await expect(page.locator('.camera-item .cam-loading').first()).toBeHidden();
  });

  test('IntersectionObserver: kamera bölümüne yaklaşmadan init yapılmaz', async ({ page }) => {
    await page.goto('/?cam=mock-live');
    await page.waitForTimeout(600);
    expect(await page.locator('.camera-item[data-cam-init="true"]').count()).toBe(0);
    await page.locator('#canli-kamera').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    expect(await page.locator('.camera-item[data-cam-init="true"]').count()).toBe(9);
    // kart başına tek init: driversCreated 9 kalmalı
    const created = await page.evaluate(
      () =>
        (window as unknown as { __cameraDebug?: { driversCreated: number } }).__cameraDebug
          ?.driversCreated,
    );
    expect(created).toBe(9);
  });

  test('tam ekran linkleri /canli-kamera.html rotasına yeni sekmede gider', async ({ page }) => {
    await page.goto('/');
    await page.locator('#canli-kamera').scrollIntoViewIfNeeded();
    const camLink = page.locator('.camera-item .cam-fullscreen').first();
    await expect(camLink).toHaveAttribute('href', '/canli-kamera.html');
    await expect(camLink).toHaveAttribute('target', '_blank');
    const ctaLink = page.locator('.btn-camera-full');
    await expect(ctaLink).toHaveAttribute('href', '/canli-kamera.html');
    await expect(ctaLink).toHaveAttribute('target', '_blank');
  });

  test('bilinmeyen cam parametresi disabled moda düşer (spinner, istek yok)', async ({ page }) => {
    const { cameraRequests } = watch(page);
    await page.goto('/?cam=hacked');
    await page.locator('#canli-kamera').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await expect(page.locator('.camera-item .cam-loading').first()).toBeVisible();
    expect(cameraRequests).toEqual([]);
  });
});

test.describe('kamera duvarı — deterministik sayaç', () => {
  test('mock-offline → 0/9 AKTİF, tüm rozetler BAĞLANTI YOK', async ({ page }) => {
    const { cameraRequests, consoleErrors } = watch(page);
    await page.goto('/canli-kamera.html?cam=mock-offline');
    await page.waitForTimeout(800);
    await expect(page.locator('#camCount')).toHaveText('0/9 AKTİF');
    const texts = await page.$$eval('.status-text', (els) => els.map((e) => e.textContent));
    expect(texts.every((t) => t === 'BAĞLANTI YOK')).toBe(true);
    expect(cameraRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('mock-live&live=3 → 3/9 AKTİF; ilk üç hücre CANLI', async ({ page }) => {
    await page.goto('/canli-kamera.html?cam=mock-live&live=3');
    await page.waitForTimeout(800);
    await expect(page.locator('#camCount')).toHaveText('3/9 AKTİF');
    const texts = await page.$$eval('.status-text', (els) => els.map((e) => e.textContent));
    expect(texts.slice(0, 3)).toEqual(['CANLI', 'CANLI', 'CANLI']);
    expect(texts.slice(3).every((t) => t === 'BAĞLANTI YOK')).toBe(true);
  });

  test('mock-live → 9/9 AKTİF; loading overlay gizli', async ({ page }) => {
    await page.goto('/canli-kamera.html?cam=mock-live');
    await page.waitForTimeout(800);
    await expect(page.locator('#camCount')).toHaveText('9/9 AKTİF');
    await expect(page.locator('.loading-overlay.hidden')).toHaveCount(9);
    const dots = await page.locator('.status-dot.live').count();
    expect(dots).toBe(9);
  });
});

test.describe('kamera duvarı — tek hücre büyütme', () => {
  test('tıklama büyütür; başka hücre öncekini kapatır; kapat bubble etmez; Escape kapatır', async ({
    page,
  }) => {
    await page.goto('/canli-kamera.html?cam=mock-live');
    await page.waitForTimeout(600);
    const cell0 = page.locator('#cell-0');
    const cell1 = page.locator('#cell-1');

    await cell0.click();
    await expect(cell0).toHaveClass(/fullscreen/);

    // Büyütme playerı yeniden oluşturmamalı
    const createdBefore = await page.evaluate(
      () =>
        (window as unknown as { __cameraDebug: { driversCreated: number } }).__cameraDebug
          .driversCreated,
    );
    expect(createdBefore).toBe(9);

    await cell0.locator('.close-btn').click();
    await expect(cell0).not.toHaveClass(/fullscreen/);
    // kapat click'i hücreye bubble edip yeniden açmamalı
    await page.waitForTimeout(200);
    await expect(page.locator('.camera-cell.fullscreen')).toHaveCount(0);

    await cell0.click();
    await expect(cell0).toHaveClass(/fullscreen/);
    // Büyütülmüş hücre viewport'u kapladığından diğer hücre fiziksel olarak
    // tıklanamaz (kaynak davranışı). Tek-hücre invariantı DOM click ile doğrulanır.
    await page.evaluate(() => (document.getElementById('cell-1') as HTMLElement).click());
    await expect(cell0).not.toHaveClass(/fullscreen/);
    await expect(cell1).toHaveClass(/fullscreen/);

    await page.keyboard.press('Escape');
    await expect(page.locator('.camera-cell.fullscreen')).toHaveCount(0);
  });
});

test.describe('kamera duvarı — ses/yenile/tam ekran/klavye', () => {
  test('mute toggle: kaynak metinler, active class, videolar; refresh state korur', async ({
    page,
  }) => {
    await page.goto('/canli-kamera.html?cam=mock-live');
    await page.waitForTimeout(600);
    const muteBtn = page.locator('#muteBtn');
    await expect(muteBtn).toHaveText('🔇 SES KAPAT');
    await expect(muteBtn).not.toHaveClass(/active/);
    expect(await page.$$eval('video', (vs) => vs.every((v) => (v as HTMLVideoElement).muted))).toBe(
      true,
    );

    await muteBtn.click();
    await expect(muteBtn).toHaveText('🔊 SES AÇ');
    await expect(muteBtn).toHaveClass(/active/);
    expect(
      await page.$$eval('video', (vs) => vs.every((v) => !(v as HTMLVideoElement).muted)),
    ).toBe(true);

    // Refresh sonrası mute state ve yeni videolar state'i devralmalı
    await page.getByRole('button', { name: /YENİLE/ }).click();
    await page.waitForTimeout(800);
    await expect(muteBtn).toHaveText('🔊 SES AÇ');
    expect(
      await page.$$eval('video', (vs) => vs.every((v) => !(v as HTMLVideoElement).muted)),
    ).toBe(true);
  });

  test('yenile: 9/9 → yeniden bağlanır; hızlı spam instance çoğaltmaz', async ({ page }) => {
    await page.goto('/canli-kamera.html?cam=mock-live');
    await page.waitForTimeout(800);
    await expect(page.locator('#camCount')).toHaveText('9/9 AKTİF');
    const refresh = page.getByRole('button', { name: /YENİLE/ });
    for (let i = 0; i < 5; i++) await refresh.click({ delay: 30 });
    await page.waitForTimeout(900);
    await expect(page.locator('#camCount')).toHaveText('9/9 AKTİF');
    const debug = await page.evaluate(
      () =>
        (window as unknown as { __cameraDebug: { driversAlive: number; driversCreated: number } })
          .__cameraDebug,
    );
    expect(debug.driversAlive).toBe(9);
    expect(await page.locator('video').count()).toBe(9);
  });

  test('r kısayolu refresh tetikler; editable focus’ta çalışmaz', async ({ page }) => {
    await page.goto('/canli-kamera.html?cam=mock-live');
    await page.waitForTimeout(800);
    const created = () =>
      page.evaluate(
        () =>
          (window as unknown as { __cameraDebug: { driversCreated: number } }).__cameraDebug
            .driversCreated,
      );
    expect(await created()).toBe(9);
    await page.keyboard.press('r');
    await page.waitForTimeout(400);
    expect(await created()).toBe(18);

    // editable element focus'undayken r çalışmamalı
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'test-input';
      document.body.appendChild(input);
      input.focus();
    });
    await page.keyboard.press('r');
    await page.waitForTimeout(300);
    expect(await created()).toBe(18);
    // Ctrl+R kombinasyonu da shortcut tetiklememeli (guard testi için evaluate ile)
    await page.evaluate(() => {
      document.getElementById('test-input')?.remove();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true }));
    });
    await page.waitForTimeout(300);
    expect(await created()).toBe(18);
  });

  test('f kısayolu ve TAM EKRAN butonu Fullscreen API çağırır (stub)', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, number>).__fsCalls = 0;
      Object.defineProperty(Document.prototype.constructor.prototype, '__unused', { value: 1 });
      HTMLElement.prototype.requestFullscreen = function () {
        (window as unknown as Record<string, number>).__fsCalls++;
        return Promise.resolve();
      };
    });
    await page.goto('/canli-kamera.html?cam=mock-offline');
    await page.waitForTimeout(400);
    await page.keyboard.press('f');
    let calls = await page.evaluate(() => (window as unknown as { __fsCalls: number }).__fsCalls);
    expect(calls).toBe(1);
    await page.getByRole('button', { name: /TAM EKRAN/ }).click();
    calls = await page.evaluate(() => (window as unknown as { __fsCalls: number }).__fsCalls);
    expect(calls).toBe(2);
  });
});

test.describe('kamera duvarı — alt bar ve saat', () => {
  test('alt bar: başta görünür, 3 sn sonra gizlenir, mousemove geri getirir', async ({ page }) => {
    await page.goto('/canli-kamera.html');
    const bar = page.locator('#bottombar');
    await expect(bar).toHaveClass(/visible/);
    await page.waitForTimeout(3400);
    await expect(bar).not.toHaveClass(/visible/);
    await page.mouse.move(200, 200);
    await expect(bar).toHaveClass(/visible/);
    // buton tıklaması barı hemen kaybettirmemeli (timer sıfırlanır)
    await page.getByRole('button', { name: /YENİLE/ }).click();
    await page.waitForTimeout(1000);
    await expect(bar).toHaveClass(/visible/);
  });

  test('saat tr-TR biçiminde saniyede bir günceller', async ({ page }) => {
    await page.goto('/canli-kamera.html');
    await page.waitForTimeout(1500);
    const t1 = await page.locator('#clock').textContent();
    expect(t1).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    await page.waitForTimeout(2100);
    const t2 = await page.locator('#clock').textContent();
    expect(t2).not.toBe(t1);
  });
});

test.describe('regression: kamera değişiklikleri galeriyi bozmadı', () => {
  test('mock modda galeri lightbox klavyesi çalışır; kamera kısayolu karışmaz', async ({
    page,
  }) => {
    await page.goto('/?cam=mock-live');
    await page.locator('#galeri').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.locator('#loadMore').click();
    await page.locator('.gallery-item').first().click();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.lightbox-counter')).toHaveText('2 / 53');
    await page.keyboard.press('Escape');
    await expect(page.locator('.lightbox')).not.toHaveClass(/active/);
  });
});
