import { test, expect, type Page } from '@playwright/test';

async function goto(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header')).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Toggle menu' })).toBeVisible();
  return response;
}

const locales = ['en', 'zh'] as const;

test.describe('Mobile header', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  for (const locale of locales) {
    test(`should keep the floating language selector pinned near the mobile header without shifting the centered logo for /${locale}`, async ({ page }) => {
      await goto(page, `/${locale}`);
      await expect(page.getByTestId('floating-lang-toggle')).toHaveAttribute('data-floating-mode', 'mobile');

      const boxes = await page.evaluate(() => {
        const header = document.querySelector('header');
        const langToggle = document.querySelector('[data-testid="floating-lang-toggle"] [aria-label="Language selector"]');
        const logo = Array.from(document.querySelectorAll<HTMLImageElement>('header a[aria-label="Home"] img')).find((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

        if (!header || !langToggle || !logo) {
          return null;
        }

        const headerRect = header.getBoundingClientRect();
        const langRect = langToggle.getBoundingClientRect();
        const logoRect = logo.getBoundingClientRect();

        return {
          headerTop: headerRect.top,
          headerRight: headerRect.right,
          langTop: langRect.top,
          langRightGap: headerRect.right - langRect.right,
          logoCenterOffset: Math.abs((logoRect.left + logoRect.right) / 2 - ((headerRect.left + headerRect.right) / 2)),
        };
      });

      expect(boxes).not.toBeNull();
      expect(boxes!.langTop).toBeGreaterThanOrEqual(boxes!.headerTop);
      expect(boxes!.langRightGap).toBeLessThan(28);
      expect(boxes!.logoCenterOffset).toBeLessThan(18);

      await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }));
      await expect(page.getByTestId('floating-lang-toggle')).toBeVisible();
    });

    test(`should open the mobile menu and navigate to about for /${locale}`, async ({ page }) => {
      await goto(page, `/${locale}`);

      const menuButton = page.getByRole('button', { name: 'Toggle menu' });
      await expect(menuButton).toBeVisible();
      await menuButton.click();
      await expect(menuButton).toHaveAttribute('aria-expanded', 'true');

      const aboutLabel = locale === 'zh' ? '關於我們' : 'About Us';
      const aboutLink = page.getByRole('link', { name: aboutLabel });
      await expect(aboutLink).toBeVisible();
      await Promise.all([
        page.waitForURL(new RegExp(`/${locale}/about$`), { timeout: 15000 }),
        aboutLink.click(),
      ]);
    });

    test(`should navigate back home from a secondary page via the mobile logo for /${locale}`, async ({ page }) => {
      await goto(page, `/${locale}/about`);

      const homeLink = page.getByTestId('header-home-link-mobile');
      await expect(homeLink).toBeVisible();
      await homeLink.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}$`), { timeout: 15000 });
    });

    test(`should close the mobile menu with Escape for /${locale}`, async ({ page }) => {
      await goto(page, `/${locale}`);

      const menuButton = page.getByRole('button', { name: 'Toggle menu' });
      await menuButton.click();
      await expect(menuButton).toHaveAttribute('aria-expanded', 'true');

      await page.keyboard.press('Escape');

      await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      await expect(menuButton).toBeFocused();
    });
  }
});
