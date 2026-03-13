import { expect, test } from '@playwright/test';

test.describe('Header utilities', () => {
  test('keeps the floating desktop language selector visible on scroll and clear of Join Us at the top of the page on wide desktop viewports', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
    await expect(page.getByTestId('floating-lang-toggle')).toHaveAttribute('data-floating-mode', 'desktop-wide');

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('header');
      const headerShell = document.querySelector('header > div');
      const langToggle = document.querySelector('[data-testid="floating-lang-toggle"] [aria-label="Language selector"]');
      const instagram = document.querySelector('[aria-label="Follow us on Instagram"]');
      const joinUsLink = document.querySelector('nav[aria-label="Primary"] a[href$="/joinus"]');
      const logo = Array.from(document.querySelectorAll<HTMLImageElement>('header a[aria-label="Home"] img')).find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      if (!header || !headerShell || !langToggle || !instagram || !logo || !joinUsLink) {
        return null;
      }

      const headerRect = header.getBoundingClientRect();
      const headerShellRect = headerShell.getBoundingClientRect();
      const langRect = langToggle.getBoundingClientRect();
      const instagramRect = instagram.getBoundingClientRect();
      const logoRect = logo.getBoundingClientRect();
      const joinUsRect = joinUsLink.getBoundingClientRect();

      return {
        headerTop: headerRect.top,
        headerBottom: headerRect.bottom,
        langTop: langRect.top,
        langOverflowRight: langRect.right - headerShellRect.right,
        navGap: langRect.left - joinUsRect.right,
        logoCenterOffset: Math.abs((logoRect.left + logoRect.right) / 2 - ((headerRect.left + headerRect.right) / 2)),
        instagramTopRatio: instagramRect.top / window.innerHeight,
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics!.langTop).toBeGreaterThanOrEqual(metrics!.headerTop);
    expect(metrics!.langOverflowRight).toBeGreaterThan(0);
    expect(metrics!.navGap).toBeGreaterThan(12);
    expect(metrics!.logoCenterOffset).toBeLessThan(20);
    expect(metrics!.instagramTopRatio).toBeGreaterThan(0.2);
    expect(metrics!.instagramTopRatio).toBeLessThan(0.4);

    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
    await expect(page.getByTestId('floating-lang-toggle')).toBeVisible();

    const scrolledTop = await page.evaluate(() => document.querySelector('[data-testid="floating-lang-toggle"]')?.getBoundingClientRect().top ?? null);
    expect(scrolledTop).not.toBeNull();
    expect(scrolledTop!).toBeLessThan(30);
  });

  test('moves the floating desktop language selector below the header when the viewport is too narrow for a safe right-side lane', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
    await expect(page.getByTestId('floating-lang-toggle')).toHaveAttribute('data-floating-mode', 'desktop-compact');

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('header');
      const langToggle = document.querySelector('[data-testid="floating-lang-toggle"] [aria-label="Language selector"]');
      const joinUsLink = document.querySelector('nav[aria-label="Primary"] a[href$="/joinus"]');

      if (!header || !langToggle || !joinUsLink) {
        return null;
      }

      const headerRect = header.getBoundingClientRect();
      const langRect = langToggle.getBoundingClientRect();
      const joinUsRect = joinUsLink.getBoundingClientRect();

      return {
        langTop: langRect.top,
        headerBottom: headerRect.bottom,
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics!.langTop).toBeGreaterThan(metrics!.headerBottom + 4);
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