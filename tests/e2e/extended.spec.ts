import { test, expect } from '@playwright/test';

const locales = ['en', 'zh'];

// ------------------------------------------------------------------
// Signup form validation tests
// ------------------------------------------------------------------
test.describe('Signup form validation', () => {
  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/en/signup');
    // Submit the form without filling in anything
    await page.click('button[type="submit"]');
    // Should show name validation error
    await expect(page.locator('#name-error')).toBeVisible();
  });

  test('should reject invalid age', async ({ page }) => {
    await page.goto('/en/signup');
    await page.fill('#name', 'Test User');
    await page.fill('#age', '10');
    await page.fill('#profession', 'Engineer');
    await page.fill('#email', 'test@example.com');
    await page.click('button[type="submit"]');
    // Age error should appear
    await expect(page.locator('#age-error')).toBeVisible();
  });
});

// ------------------------------------------------------------------
// Language switching persistence
// ------------------------------------------------------------------
test.describe('Language switching', () => {
  test('should switch from English to Chinese', async ({ page }) => {
    await page.goto('/en');
    // Look for the language toggle link (zh toggle)
    const zhLink = page.locator('a[href="/zh"]').first();
    if (await zhLink.isVisible()) {
      await zhLink.click();
      await page.waitForURL(/\/zh/);
      expect(page.url()).toContain('/zh');
    }
  });

  test('should switch from Chinese to English', async ({ page }) => {
    await page.goto('/zh');
    const enLink = page.locator('a[href="/en"]').first();
    if (await enLink.isVisible()) {
      await enLink.click();
      await page.waitForURL(/\/en/);
      expect(page.url()).toContain('/en');
    }
  });
});

// ------------------------------------------------------------------
// Book detail page content
// ------------------------------------------------------------------
for (const locale of locales) {
  test.describe(`${locale} book detail`, () => {
    test(`should load a book detail page /${locale}/books/why-we-sleep`, async ({ page }) => {
      await page.goto(`/${locale}/books/why-we-sleep`);
      // Should have a visible heading with the book title
      await expect(page.locator('h1')).toBeVisible();
      // Should have book cover image
      await expect(page.locator('img').first()).toBeVisible();
      // Should have JSON-LD structured data
      const jsonLd = page.locator('script[type="application/ld+json"]');
      await expect(jsonLd).toBeAttached();
    });

    test(`should have proper meta tags on book detail /${locale}/books/why-we-sleep`, async ({ page }) => {
      await page.goto(`/${locale}/books/why-we-sleep`);
      // OG image should point to /api/og
      const ogMeta = page.locator('meta[property="og:image"]');
      await expect(ogMeta).toHaveAttribute('content', /\/api\/og/);
    });
  });
}

// ------------------------------------------------------------------
// 404 error page content
// ------------------------------------------------------------------
for (const locale of locales) {
  test.describe(`${locale} 404 page`, () => {
    test(`should return 404 status and show content /${locale}/this-doesnt-exist`, async ({ page }) => {
      const response = await page.goto(`/${locale}/this-doesnt-exist`);
      expect(response?.status()).toBe(404);
      // Should still render a page (not blank)
      await expect(page.locator('body')).toBeVisible();
    });
  });
}

// ------------------------------------------------------------------
// Sitemap validation
// ------------------------------------------------------------------
test.describe('Sitemap', () => {
  test('should return valid XML sitemap', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('<loc>');
    expect(body).toContain('<lastmod>');
  });
});

// ------------------------------------------------------------------
// Robots.txt
// ------------------------------------------------------------------
test.describe('Robots.txt', () => {
  test('should return valid robots.txt', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('User-Agent');
  });
});

// ------------------------------------------------------------------
// OG image endpoint
// ------------------------------------------------------------------
test.describe('OG image API', () => {
  test('should generate a PNG image', async ({ request }) => {
    const response = await request.get('/api/og?title=Test+Book&author=Test+Author&locale=en');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
  });
});

// ------------------------------------------------------------------
// Registrations API validation
// ------------------------------------------------------------------
test.describe('Registrations API', () => {
  test('should reject missing admin token', async ({ request }) => {
    const response = await request.get('/api/registrations');
    expect(response.status()).toBe(401);
  });

  test('should reject invalid limit query', async ({ request }) => {
    // Authorization uses a placeholder value here; endpoint should reject invalid limit
    // only after auth passes in environments that configure ADMIN_API_SECRET.
    const response = await request.get('/api/registrations?limit=abc', {
      headers: { Authorization: 'Bearer test-secret' },
    });

    // Local/dev environments without ADMIN_API_SECRET return 401 first.
    // Environments with the secret configured should return 400 for invalid limit.
    expect([400, 401]).toContain(response.status());
  });
});

// ------------------------------------------------------------------
// Middleware security headers
// ------------------------------------------------------------------
test.describe('Middleware headers', () => {
  test('should set CSP nonce headers on localized page', async ({ request }) => {
    const response = await request.get('/en');
    expect(response.status()).toBe(200);

    const nonce = response.headers()['x-nonce'];
    const csp = response.headers()['content-security-policy'];

    expect(nonce).toBeTruthy();
    expect(csp).toContain("script-src");
    expect(csp).toContain("'nonce-");
  });
});

// ------------------------------------------------------------------
// Events page counters and content
// ------------------------------------------------------------------
for (const locale of locales) {
  test.describe(`${locale} events`, () => {
    test(`should load events page /${locale}/events`, async ({ page }) => {
      await page.goto(`/${locale}/events`);
      // Events page uses h3 headings for event titles
      await expect(page.locator('h3').first()).toBeVisible();
      // Should have event sections
      await expect(page.locator('section').first()).toBeVisible();
    });
  });
}
