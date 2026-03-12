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
    test(`should keep the language selector inside the mobile header for /${locale}`, async ({ page }) => {
      await goto(page, `/${locale}`);

      const boxes = await page.evaluate(() => {
        const header = document.querySelector('header');
        const langToggle = document.querySelector('[data-testid="header-lang-toggle-mobile"] [aria-label="Language selector"]');
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
          headerBottom: headerRect.bottom,
          headerRight: headerRect.right,
          headerCenterX: (headerRect.left + headerRect.right) / 2,
          langBottom: langRect.bottom,
          langTop: langRect.top,
          langRightGap: headerRect.right - langRect.right,
          logoCenterOffset: Math.abs((logoRect.left + logoRect.right) / 2 - ((headerRect.left + headerRect.right) / 2)),
        };
      });

      expect(boxes).not.toBeNull();
      expect(boxes!.langTop).toBeGreaterThanOrEqual(boxes!.headerTop);
      expect(boxes!.langBottom).toBeLessThanOrEqual(boxes!.headerBottom);
      expect(boxes!.langRightGap).toBeLessThan(28);
      expect(boxes!.logoCenterOffset).toBeLessThan(18);
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
      await aboutLink.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/about$`));
    });

    test(`should navigate back home from a secondary page via the mobile logo for /${locale}`, async ({ page }) => {
      await goto(page, `/${locale}/about`);

      const homeLink = page.locator('a[aria-label="Home"]').filter({ has: page.locator('img') }).last();
      await expect(homeLink).toBeVisible();
      await Promise.all([
        page.waitForURL(new RegExp(`/${locale}$`), { timeout: 15000 }),
        homeLink.click(),
      ]);
    });
  }
});
