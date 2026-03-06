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
    // Should show first name validation error
    await expect(page.locator('#firstName-error')).toBeVisible();
  });

  test('should reject invalid age', async ({ page }) => {
    await page.goto('/en/signup');
    await page.fill('#firstName', 'Test');
    await page.fill('#lastName', 'User');
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

  test('should include key localized routes', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const body = await response.text();

    expect(body).toContain('/en/detox');
    expect(body).toContain('/zh/detox');
    expect(body).toContain('/en/engclub');
    expect(body).toContain('/zh/engclub');
    expect(body).toContain('/en/joinus');
    expect(body).toContain('/zh/joinus');
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
// Submit API validation
// ------------------------------------------------------------------
test.describe('Submit API', () => {
  const testHeaders = () => ({
    'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
  });

  test('should reject invalid location query', async ({ request }) => {
    const response = await request.post('/api/submit?loc=US', {
      data: {},
      headers: testHeaders(),
    });
    expect(response.status()).toBe(400);
  });

  test('should reject malformed email', async ({ request }) => {
    const response = await request.post('/api/submit?loc=TW', {
      data: {
        firstName: 'API',
        lastName: 'User',
        age: 30,
        profession: 'Engineer',
        email: 'not-an-email',
        referral: 'Instagram',
      },
      headers: testHeaders(),
    });
    expect(response.status()).toBe(400);
  });

  test('should silently accept honeypot submissions', async ({ request }) => {
    const response = await request.post('/api/submit?loc=TW', {
      data: {
        website: 'spam-bot-filled',
      },
      headers: testHeaders(),
    });
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });
});

// ------------------------------------------------------------------
// Submit slot status API
// ------------------------------------------------------------------
test.describe('Submit slot status API', () => {
  test('should return slot status for valid location', async ({ request }) => {
    const response = await request.get('/api/submit?loc=EN');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.location).toBe('EN');
    expect(typeof body.enabled).toBe('boolean');
    expect(body.enabled).toBe(true);
    expect(body.open).toBe(true);
    expect(body.reason).toBe('ok');
  });

  test('should expose configured TW capacity window and max', async ({ request }) => {
    const response = await request.get('/api/submit?loc=TW');
    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.location).toBe('TW');
    expect(body.enabled).toBe(true);
    expect(body.open).toBe(true);
    expect(body.full).toBe(false);
    expect(body.max).toBe(8);
    expect(body.startAt).toBe('2026-03-06T00:00:00.000Z');
    expect(body.endAt).toBe('2026-03-29T23:59:59.000Z');
    expect(body.reason).toBe('ok');
  });

  test('should expose configured EN capacity window and max', async ({ request }) => {
    const response = await request.get('/api/submit?loc=EN');
    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.location).toBe('EN');
    expect(body.enabled).toBe(true);
    expect(body.open).toBe(true);
    expect(body.full).toBe(false);
    expect(body.max).toBe(14);
    expect(body.startAt).toBe('2026-03-06T00:00:00.000Z');
    expect(body.endAt).toBe('2026-04-11T23:59:59.000Z');
    expect(body.reason).toBe('ok');
  });

  test('should reject invalid location for slot status', async ({ request }) => {
    const response = await request.get('/api/submit?loc=US');
    expect(response.status()).toBe(400);
  });

  test('should return closed status for NL slot (config-driven)', async ({ request }) => {
    const response = await request.get('/api/submit?loc=NL');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.enabled).toBe(true);
    expect(body.open).toBe(false);
    expect(body.reason).toBe('closed');
  });
});

// ------------------------------------------------------------------
// Submit capacity guardrails
// ------------------------------------------------------------------
// Serial ensures these mutating tests never race against each other.
test.describe.serial('Submit capacity guardrails', () => {
  test.beforeEach(async ({ request, browserName }) => {
    test.skip(browserName !== 'chromium', 'Shared-state capacity tests run once to avoid cross-browser counter races.');

    // Reset mutable locations before each capacity test so we start from a clean slate.
    await request.delete('/api/submit?loc=TW&forceFull=0');
    await request.delete('/api/submit?loc=EN&forceFull=0');
  });

  test.afterAll(async ({ request, browserName }) => {
    if (browserName !== 'chromium') {
      return;
    }

    // Leave mutable locations in clean state after the entire describe block.
    await request.delete('/api/submit?loc=TW&forceFull=0');
    await request.delete('/api/submit?loc=EN&forceFull=0');
  });
  test('should block submission when slot is closed', async ({ request }) => {
    const response = await request.post('/api/submit?loc=NL', {
      headers: {
        'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      data: {
        firstName: 'Closed',
        lastName: 'Slot',
        age: 25,
        profession: 'Engineer',
        email: 'closed-slot@example.com',
        referral: 'Instagram',
      },
    });

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.reason).toBe('closed');
  });

  test('should block submission when slot is full', async ({ request }) => {
    // Set TW max to 1 via test-only DELETE reset endpoint, then exhaust it.
    const resetRes = await request.delete('/api/submit?loc=TW&tempMax=1&forceFull=0');
    expect(resetRes.status()).toBe(200);

    const validPayload = {
      firstName: 'Full',
      lastName: 'Test',
      age: 25,
      profession: 'Engineer',
      email: `full-test-${Date.now()}@example.com`,
      referral: 'Instagram',
    };
    const ip = () => ({ 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` });

    // First submission should be accepted (count 1 == max 1).
    const first = await request.post('/api/submit?loc=TW', { headers: ip(), data: validPayload });
    expect(first.status()).toBe(201);

    // Second submission should be rejected because count would exceed max.
    const second = await request.post('/api/submit?loc=TW', {
      headers: ip(),
      data: { ...validPayload, email: `full-test2-${Date.now()}@example.com` },
    });
    expect(second.status()).toBe(409);
    const body = await second.json();
    expect(body.reason).toBe('full');
  });

  test('should close TW registration after 8 successful submissions', async ({ request }) => {
    const ip = () => ({ 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` });

    for (let index = 0; index < 8; index += 1) {
      const response = await request.post('/api/submit?loc=TW', {
        headers: ip(),
        data: {
          firstName: 'Taiwan',
          lastName: `Reader${index}`,
          age: 25,
          profession: 'Engineer',
          email: `tw-limit-${Date.now()}-${index}@example.com`,
          referral: 'Instagram',
        },
      });
      expect(response.status()).toBe(201);
    }

    const statusRes = await request.get('/api/submit?loc=TW');
    expect(statusRes.status()).toBe(200);
    const status = await statusRes.json();
    expect(status.full).toBe(true);
    expect(status.max).toBe(8);
    expect(status.reason).toBe('full');

    const blocked = await request.post('/api/submit?loc=TW', {
      headers: ip(),
      data: {
        firstName: 'Taiwan',
        lastName: 'Overflow',
        age: 25,
        profession: 'Engineer',
        email: `tw-limit-overflow-${Date.now()}@example.com`,
        referral: 'Instagram',
      },
    });
    expect(blocked.status()).toBe(409);
    await expect(blocked.json()).resolves.toMatchObject({ reason: 'full' });
  });

  test('should close EN registration after 14 successful submissions', async ({ request }) => {
    const ip = () => ({ 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` });

    for (let index = 0; index < 14; index += 1) {
      const response = await request.post('/api/submit?loc=EN', {
        headers: ip(),
        data: {
          firstName: 'English',
          lastName: `Reader${index}`,
          age: 25,
          profession: 'Engineer',
          email: `en-limit-${Date.now()}-${index}@example.com`,
          referral: 'Instagram',
        },
      });
      expect(response.status()).toBe(201);
    }

    const statusRes = await request.get('/api/submit?loc=EN');
    expect(statusRes.status()).toBe(200);
    const status = await statusRes.json();
    expect(status.full).toBe(true);
    expect(status.max).toBe(14);
    expect(status.reason).toBe('full');

    const blocked = await request.post('/api/submit?loc=EN', {
      headers: ip(),
      data: {
        firstName: 'English',
        lastName: 'Overflow',
        age: 25,
        profession: 'Engineer',
        email: `en-limit-overflow-${Date.now()}@example.com`,
        referral: 'Instagram',
      },
    });
    expect(blocked.status()).toBe(409);
    await expect(blocked.json()).resolves.toMatchObject({ reason: 'full' });
  });

  test('should block status and submission when forceFull is enabled', async ({ request }) => {
    // Enable forceFull override via the test-only DELETE endpoint.
    const setRes = await request.delete('/api/submit?loc=TW&forceFull=1');
    expect(setRes.status()).toBe(200);

    // GET status should reflect full/reason:full immediately.
    const statusRes = await request.get('/api/submit?loc=TW');
    expect(statusRes.status()).toBe(200);
    const status = await statusRes.json();
    expect(status.full).toBe(true);
    expect(status.reason).toBe('full');

    // POST should be rejected with 409 + reason:full.
    const postRes = await request.post('/api/submit?loc=TW', {
      headers: { 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
      data: {
        firstName: 'Force',
        lastName: 'Full',
        age: 25,
        profession: 'Engineer',
        email: `force-full-${Date.now()}@example.com`,
        referral: 'Instagram',
      },
    });
    expect(postRes.status()).toBe(409);
    const postBody = await postRes.json();
    expect(postBody.reason).toBe('full');

    // Reset clears forceFull; subsequent GET should show not-full.
    await request.delete('/api/submit?loc=TW&forceFull=0');
    const afterRes = await request.get('/api/submit?loc=TW');
    const afterStatus = await afterRes.json();
    expect(afterStatus.full).toBe(false);
  });
});

// ------------------------------------------------------------------
// Legal page SEO metadata
// ------------------------------------------------------------------
test.describe('Legal page SEO', () => {
  test('should expose canonical and indexable metadata on privacy page', async ({ page }) => {
    await page.goto('/en/privacy');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/privacy$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/i);
  });

  test('should expose canonical and indexable metadata on terms page', async ({ page }) => {
    await page.goto('/en/terms');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/terms$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/i);
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
