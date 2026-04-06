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

  test.describe('Events dropdown navigation', () => {
    test('should show events dropdown on hover (desktop)', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/en', { waitUntil: 'domcontentloaded' });

      const eventsButton = page.locator('nav[aria-label="Primary"] button:has-text("Events")');
      await expect(eventsButton).toBeVisible();

      // Dropdown should not be visible initially
      await expect(page.locator('a[href="/en/events/TW"]')).not.toBeVisible();

      // Hover over events button
      await eventsButton.hover();

      // Dropdown should appear
      await expect(page.locator('a[href="/en/events/TW"]')).toBeVisible({ timeout: 1000 });
      await expect(page.locator('a[href="/en/events/NL"]')).toBeVisible();
      await expect(page.locator('a[href="/en/events/ONLINE"]')).toBeVisible();
    });

    test('should navigate to correct venue page when clicking dropdown option', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/en', { waitUntil: 'domcontentloaded' });

      const eventsButton = page.locator('nav[aria-label="Primary"] button:has-text("Events")');
      await eventsButton.hover();

      const taiwanLink = page.locator('a[href="/en/events/TW"]');
      await taiwanLink.waitFor({ state: 'visible' });

      await taiwanLink.click();
      await page.waitForURL('/en/events/TW', { waitUntil: 'domcontentloaded' });

      // Verify we're on the Taiwan events page
      await expect(page).toHaveURL('/en/events/TW');
      await expect(page.locator('section').first()).toBeVisible();
    });

    test('should navigate between venue pages via dropdown', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/en/events/TW', { waitUntil: 'domcontentloaded' });

      // Open dropdown and navigate to NL
      const eventsButton = page.locator('nav[aria-label="Primary"] button:has-text("Events")');
      await eventsButton.hover();

      const nlLink = page.locator('a[href="/en/events/NL"]');
      await nlLink.waitFor({ state: 'visible' });
      await nlLink.click();

      await page.waitForURL('/en/events/NL', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL('/en/events/NL');
    });

    test('should open events dropdown on click (mobile)', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/en', { waitUntil: 'domcontentloaded' });

      // Open mobile menu
      const menuButton = page.getByRole('button', { name: 'Toggle menu' });
      await menuButton.click();

      const eventsButton = page.locator('button:has-text("Events")').last();
      await expect(eventsButton).toBeVisible();

      // Dropdown should not be visible initially
      await expect(page.locator('a[href="/en/events/TW"]').last()).not.toBeVisible();

      // Click events button
      await eventsButton.click();

      // Dropdown should appear
      await expect(page.locator('a[href="/en/events/TW"]').last()).toBeVisible({ timeout: 1000 });
    });
  });
});