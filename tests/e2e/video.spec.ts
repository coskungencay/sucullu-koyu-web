import { expect, test } from '@playwright/test';

// Playwright Chromium H.264 codec'i içermez (metadata yüklenemez);
// kaynak parity'nin doğrulanabilmesi için branded Chrome kullanılır.
test.use({ channel: 'chrome' });

test.describe('tanıtım videosu', () => {
  test('poster/source/controls doğru; autoplay ve loop kapalı', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('.video-wrapper video');
    await expect(video).toHaveAttribute('poster', 'gorseller/hero.jpg');
    await expect(video).toHaveAttribute('controls', '');
    await expect(video.locator('source')).toHaveAttribute('src', 'gorseller/tanitim-video.mp4');
    const props = await video.evaluate((el) => {
      const v = el as HTMLVideoElement;
      return { autoplay: v.autoplay, loop: v.loop, paused: v.paused };
    });
    expect(props.autoplay).toBe(false);
    expect(props.loop).toBe(false);
    expect(props.paused).toBe(true);
  });

  test('video metadata: 848×480, ~60.65 s', async ({ page }) => {
    await page.goto('/');
    await page.locator('#video').scrollIntoViewIfNeeded();
    const meta = await page.locator('.video-wrapper video').evaluate(async (el) => {
      const v = el as HTMLVideoElement;
      if (v.readyState < 1) {
        const loaded = new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
        v.load();
        await loaded;
      }
      return { w: v.videoWidth, h: v.videoHeight, d: v.duration };
    });
    expect(meta.w).toBe(848);
    expect(meta.h).toBe(480);
    expect(meta.d).toBeGreaterThan(60.6);
    expect(meta.d).toBeLessThan(60.7);
  });
});
