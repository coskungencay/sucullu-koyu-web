import { expect, test } from '@playwright/test';

const SECTION_ORDER = [
  'anasayfa',
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
];

test.describe('ana sayfa', () => {
  test('yüklenir; console error ve kırık first-party asset yok', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('requestfailed', (r) => {
      // preload="metadata" videosunun tarayıcı tarafından kesilmesi (ERR_ABORTED)
      // kaynak sitede de görülen normal davranıştır; kırık asset sayılmaz.
      if (r.failure()?.errorText !== 'net::ERR_ABORTED') failedRequests.push(r.url());
    });
    page.on('response', (r) => {
      if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
    });

    await page.goto('/');
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y <= document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
    });
    await page.waitForTimeout(1000);

    expect(consoleErrors).toEqual([]);
    // Google Maps iframe'inin kendi iç istekleri first-party sayılmaz
    const firstParty = failedRequests.filter((u) => u.includes('localhost'));
    expect(firstParty).toEqual([]);
  });

  test('title ve meta kaynakla birebir', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Sücüllü Köyü | Yalvaç / Isparta');
    const desc = page.locator('meta[name="description"]');
    await expect(desc).toHaveAttribute(
      'content',
      "Sücüllü Köyü - Isparta ili Yalvaç ilçesine bağlı, Göller Bölgesi'nin kalbinde yer alan tarihi ve kültürel açıdan zengin bir Anadolu köyü.",
    );
  });

  test('section sırası ve anchor IDleri kaynakla birebir', async ({ page }) => {
    await page.goto('/');
    const ids = await page.$$eval('section[id]', (els) => els.map((e) => e.id));
    expect(ids).toEqual(SECTION_ORDER);
    await expect(page.locator('footer#iletisim')).toHaveCount(1);
  });

  test('hero içerik ve animasyon settle', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero h1')).toHaveText('Sücüllü Köyü');
    await expect(page.locator('.hero-location')).toContainText('Yalvaç / Isparta');
    await expect(page.locator('.hero-btn')).toContainText('Keşfet');
    await page.waitForTimeout(2300);
    await expect(page.locator('.hero')).toHaveClass(/loaded/);
    const opacity = await page.locator('.hero-btn').evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBe(1);
  });

  test('stats sayaçları hedef değerlere ulaşır (tr-TR biçimi)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#stats').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    const values = await page.$$eval('.stat-number', (els) => els.map((e) => e.textContent));
    expect(values).toEqual(['1.502', '6', '1.096 m', '1.478']);
  });

  test('tarihçe 6 madde, mahalleler 6 kart, ekonomi chipleri tam', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.timeline-item')).toHaveCount(6);
    await expect(page.locator('.neighborhood-card')).toHaveCount(6);
    const chips = await page.$$eval('.economy-card:first-child .economy-list span', (els) =>
      els.map((e) => e.textContent?.trim()),
    );
    expect(chips).toEqual([
      'Buğday',
      'Arpa',
      'Nohut',
      'Elma',
      'Kiraz',
      'Kayısı',
      'Ceviz',
      'Üzüm',
      'Domates',
      'Fasulye',
    ]);
  });

  test('galeri: 53 item, ilk 12 görünür, 41 hidden', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.gallery-item')).toHaveCount(53);
    await expect(page.locator('.gallery-item:not(.hidden)')).toHaveCount(12);
    await expect(page.locator('.gallery-item.hidden')).toHaveCount(41);
    await expect(page.locator('#loadMore')).toBeVisible();
  });

  test('kamera bölümü: 9 kart, kaynak etiketleri, hiçbir kamera ağ isteği yok', async ({
    page,
  }) => {
    const cameraRequests: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('m3u8') || r.url().includes('kameraizle')) cameraRequests.push(r.url());
    });
    await page.goto('/');
    await page.locator('#canli-kamera').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await expect(page.locator('.camera-item')).toHaveCount(9);
    const labels = await page.$$eval('.camera-item .cam-label', (els) =>
      els.map((e) => e.textContent),
    );
    expect(labels).toEqual([
      'KAMERA 01',
      'KAMERA 02',
      'KAMERA 04',
      'KAMERA 05',
      'KAMERA 07',
      'KAMERA 08',
      'KAMERA 11',
      'KAMERA 10',
      'P850',
    ]);
    await expect(page.locator('.camera-item .cam-loading').first()).toBeVisible();
    expect(cameraRequests).toEqual([]);
  });

  test('navbar scroll durumu ve aktif link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.navbar')).not.toHaveClass(/scrolled/);
    await page.locator('#tarihce').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await expect(page.locator('.navbar')).toHaveClass(/scrolled/);
    await expect(page.locator('.nav-links a[href="#tarihce"]')).toHaveClass(/active/);
  });

  test('scroll-to-top butonu görünür ve başa döner', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.back-to-top')).not.toHaveClass(/visible/);
    await page.locator('#konum').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await expect(page.locator('.back-to-top')).toHaveClass(/visible/);
    await page.locator('.back-to-top').click();
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('mobil hamburger menü açılır/kapanır (390x844)', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto('http://localhost:4173/');
    await expect(page.locator('.hamburger')).toBeVisible();
    await page.locator('.hamburger').click();
    await expect(page.locator('.nav-links')).toHaveClass(/active/);
    await expect(page.locator('.mobile-overlay')).toHaveClass(/active/);
    await page.locator('.nav-links a[href="#tarihce"]').click();
    await expect(page.locator('.nav-links')).not.toHaveClass(/active/);
    await context.close();
  });

  test('video poster ve kaynak dosya kaynakla aynı', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('.video-wrapper video');
    await expect(video).toHaveAttribute('poster', 'gorseller/hero.jpg');
    await expect(video.locator('source')).toHaveAttribute('src', 'gorseller/tanitim-video.mp4');
  });
});

test.describe('canlı kamera duvarı rotası', () => {
  test('rota yüklenir; 3x3 grid, duvar etiketleri, 0/9 AKTİF, ağ isteği yok', async ({ page }) => {
    const cameraRequests: string[] = [];
    const consoleErrors: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('m3u8') || r.url().includes('kameraizle')) cameraRequests.push(r.url());
    });
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    await page.goto('/canli-kamera.html');
    await expect(page).toHaveTitle('Sücüllü Köyü — Canlı Kamera');
    await expect(page.locator('.camera-cell')).toHaveCount(9);
    const labels = await page.$$eval('.camera-label', (els) => els.map((e) => e.textContent));
    expect(labels).toEqual([
      'KAMERA 01',
      'KAMERA 02',
      'KAMERA 03',
      'KAMERA 04',
      'KAMERA 05',
      'KAMERA 06',
      'KAMERA 07',
      'KAMERA 08',
      'KAMERA 09',
    ]);
    await expect(page.locator('#camCount')).toHaveText('0/9 AKTİF');
    await expect(page.locator('.status-text').first()).toHaveText('BAĞLANTI YOK');
    await page.waitForTimeout(1500);
    const clock = await page.locator('#clock').textContent();
    expect(clock).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(cameraRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
