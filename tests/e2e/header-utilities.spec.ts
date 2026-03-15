import { expect, test } from '@playwright/test';

test.describe('Header utilities', () => {
  test('keeps the floating desktop language selector visible on scroll and pinned near the viewport edge on wide desktop viewports', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByTestId('floating-lang-toggle')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('header');
      const shell = document.querySelector('[data-testid="header-shell"]');
      const nav = document.querySelector('[data-testid="header-primary-nav"]');
      const langToggle = document.querySelector('[data-testid="floating-lang-toggle"] [aria-label="Language selector"]');
      const instagram = document.querySelector('[aria-label="Follow us on Instagram"]');
      const joinUsLink = document.querySelector('nav[aria-label="Primary"] a[href$="/joinus"]');

      if (!header || !shell || !nav || !langToggle || !instagram || !joinUsLink) {
        return null;
      }

      const headerRect = header.getBoundingClientRect();
      const shellRect = shell.getBoundingClientRect();
      const shellStyles = window.getComputedStyle(shell);
      const navRect = nav.getBoundingClientRect();
      const langRect = langToggle.getBoundingClientRect();
      const instagramRect = instagram.getBoundingClientRect();

      return {
        headerTop: headerRect.top,
        shellInnerWidth: shellRect.width - parseFloat(shellStyles.paddingLeft) - parseFloat(shellStyles.paddingRight),
        navWidth: navRect.width,
        langTop: langRect.top,
        langRightGap: window.innerWidth - langRect.right,
        langWidth: langRect.width,
        instagramTopRatio: instagramRect.top / window.innerHeight,
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics!.langTop).toBeGreaterThanOrEqual(metrics!.headerTop);
    expect(Math.abs(metrics!.navWidth - metrics!.shellInnerWidth)).toBeLessThanOrEqual(1);
    expect(metrics!.langRightGap).toBeGreaterThanOrEqual(8);
    expect(metrics!.langRightGap).toBeLessThanOrEqual(20);
    expect(metrics!.langWidth).toBeGreaterThan(95);
    expect(metrics!.instagramTopRatio).toBeGreaterThan(0.2);
    expect(metrics!.instagramTopRatio).toBeLessThan(0.4);

    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
    await expect(page.getByTestId('floating-lang-toggle')).toBeVisible();

    const scrolledTop = await page.evaluate(() => document.querySelector('[data-testid="floating-lang-toggle"]')?.getBoundingClientRect().top ?? null);
    expect(scrolledTop).not.toBeNull();
    expect(scrolledTop!).toBeLessThan(30);
  });

  test('keeps the floating desktop language selector in the same top-right lane on narrower desktop widths without clipping', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByTestId('floating-lang-toggle')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('header');
      const shell = document.querySelector('[data-testid="header-shell"]');
      const nav = document.querySelector('[data-testid="header-primary-nav"]');
      const langToggle = document.querySelector('[data-testid="floating-lang-toggle"] [aria-label="Language selector"]');

      if (!header || !shell || !nav || !langToggle) {
        return null;
      }

      const headerRect = header.getBoundingClientRect();
      const shellRect = shell.getBoundingClientRect();
      const shellStyles = window.getComputedStyle(shell);
      const navRect = nav.getBoundingClientRect();
      const langRect = langToggle.getBoundingClientRect();

      return {
        langTop: langRect.top,
        headerTop: headerRect.top,
        shellInnerWidth: shellRect.width - parseFloat(shellStyles.paddingLeft) - parseFloat(shellStyles.paddingRight),
        navWidth: navRect.width,
        langRightGap: window.innerWidth - langRect.right,
        langWidth: langRect.width,
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics!.langTop).toBeGreaterThanOrEqual(metrics!.headerTop);
    expect(Math.abs(metrics!.navWidth - metrics!.shellInnerWidth)).toBeLessThanOrEqual(1);
    expect(metrics!.langRightGap).toBeGreaterThanOrEqual(8);
    expect(metrics!.langRightGap).toBeLessThanOrEqual(20);
    expect(metrics!.langWidth).toBeGreaterThan(95);
  });

  test('keeps the mobile Instagram button closer to the lower third', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toggle menu' })).toBeVisible();

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