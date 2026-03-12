import { expect, test } from '@playwright/test';

test.describe('Header utilities', () => {
  test('keeps the desktop language selector inside the header and the Instagram button near the upper third', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toHaveAttribute('data-ready', 'true', { timeout: 15000 });

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('header');
      const langToggle = document.querySelector('[data-testid="header-lang-toggle-desktop"] [aria-label="Language selector"]');
      const instagram = document.querySelector('[aria-label="Follow us on Instagram"]');

      if (!header || !langToggle || !instagram) {
        return null;
      }

      const headerRect = header.getBoundingClientRect();
      const langRect = langToggle.getBoundingClientRect();
      const instagramRect = instagram.getBoundingClientRect();

      return {
        headerTop: headerRect.top,
        headerBottom: headerRect.bottom,
        langTop: langRect.top,
        langBottom: langRect.bottom,
        instagramTopRatio: instagramRect.top / window.innerHeight,
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics!.langTop).toBeGreaterThanOrEqual(metrics!.headerTop);
    expect(metrics!.langBottom).toBeLessThanOrEqual(metrics!.headerBottom);
    expect(metrics!.instagramTopRatio).toBeGreaterThan(0.2);
    expect(metrics!.instagramTopRatio).toBeLessThan(0.4);
  });

  test('keeps the mobile Instagram button closer to the lower third', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toHaveAttribute('data-ready', 'true', { timeout: 15000 });

    const metrics = await page.evaluate(() => {
      const instagram = document.querySelector('[aria-label="Follow us on Instagram"]');
      if (!instagram) {
        return null;
      }

      const instagramRect = instagram.getBoundingClientRect();
      return {
        instagramTopRatio: instagramRect.top / window.innerHeight,
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics!.instagramTopRatio).toBeGreaterThan(0.55);
    expect(metrics!.instagramTopRatio).toBeLessThan(0.8);
  });
});