import { test, expect, type Page } from '@playwright/test';

async function goto(page: Page, path: string) {
  return page.goto(path, { waitUntil: 'domcontentloaded' });
}

// 基本首頁與 i18n 測試
const locales = ['en', 'zh'];

for (const locale of locales) {
  test.describe(`${locale} locale`, () => {
    test(`should load home page /${locale}`, async ({ page }) => {
      await goto(page, `/${locale}`);
      await expect(page).toHaveTitle(/Book Digest|書摘牆/);
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();
    });

    test(`should navigate to about page /${locale}/about`, async ({ page }) => {
      await goto(page, `/${locale}/about`);
      await expect(page.locator('h1')).toBeVisible();
    });

    test(`should show not-found for invalid page /${locale}/not-exist`, async ({ page }) => {
      const response = await goto(page, `/${locale}/not-exist`);
      expect(response?.status()).toBe(404);
    });
  });
}

// 書籍牆與動態書籍頁面
for (const locale of locales) {
  test.describe(`${locale} books`, () => {
    test(`should load books wall /${locale}/books`, async ({ page }) => {
      await goto(page, `/${locale}/books`);
      // Books page has no h1 (intentionally removed), check for the book grid
      await expect(page.locator('ul').first()).toBeVisible();
      await expect(page.locator('li').first()).toBeVisible();
    });
  });
}
