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
    test(`should keep utility controls out of the mobile header tap zone for /${locale}`, async ({ page }) => {
      await goto(page, `/${locale}`);

      const boxes = await page.evaluate(() => {
        const header = document.querySelector('header');
        const langToggle = document.querySelector('[aria-label="Language selector"]');

        if (!header || !langToggle) {
          return null;
        }

        const headerRect = header.getBoundingClientRect();
        const langRect = langToggle.getBoundingClientRect();

        return {
          headerBottom: headerRect.bottom,
          langTop: langRect.top,
        };
      });

      expect(boxes).not.toBeNull();
      expect(boxes!.langTop).toBeGreaterThanOrEqual(boxes!.headerBottom);
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
      await homeLink.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    });
  }
});
