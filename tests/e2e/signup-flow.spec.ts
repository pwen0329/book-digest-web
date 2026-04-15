import { expect, test } from '@playwright/test';

test.describe('Signup Flow', () => {
  const adminHeaders = {
    'Authorization': 'Bearer test-admin',
  };

  let eventTypes: Array<{ code: string; nameEn: string; nameZh: string }> = [];

  // Track created resources for cleanup
  type TestCleanup = {
    events: number[];
    venues: number[];
    books: number[];
  };

  let cleanup: TestCleanup = { events: [], venues: [], books: [] };

  test.beforeAll(async ({ request }) => {
    const eventTypesResponse = await request.get('/api/admin/event-types', {
      headers: adminHeaders,
    });
    expect(eventTypesResponse.ok()).toBeTruthy();
    const data = await eventTypesResponse.json();
    eventTypes = data.eventTypes;
    expect(eventTypes.length).toBeGreaterThan(0);
  });

  test.beforeEach(() => {
    cleanup = { events: [], venues: [], books: [] };
  });

  test.afterEach(async ({ request }) => {
    // Delete in correct order due to foreign key constraints: events -> venues -> books
    for (const eventId of cleanup.events) {
      await request.delete(`/api/admin/event-v2/${eventId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }

    for (const venueId of cleanup.venues) {
      await request.delete(`/api/admin/venue-v2/${venueId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }

    for (const bookId of cleanup.books) {
      await request.delete(`/api/admin/book-v2/${bookId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }
  });

  test('language toggle preserves signup step without flashing to intro', async ({ page, request }) => {
    const eventTypeCode = eventTypes[0].code;
    const timestamp = `${Date.now()}-lang-${Math.random().toString(36).slice(2, 9)}`;
    const bookSlug = `test-book-${timestamp}`;
    const venueSlug = `test-venue-${timestamp}`;
    const eventSlug = `test-event-${timestamp}`;

    // Create book, venue, and event
    const bookResponse = await request.post('/api/admin/book-v2', {
      headers: adminHeaders,
      data: {
        slug: bookSlug,
        title: 'Lang Test Book',
        author: 'Lang Test Author',
      },
    });
    expect(bookResponse.ok()).toBeTruthy();
    const bookData = await bookResponse.json();
    cleanup.books.push(bookData.book.id);

    const venueResponse = await request.post('/api/admin/venue-v2', {
      headers: adminHeaders,
      data: {
        name: venueSlug,
        location: 'TW',
        maxCapacity: 20,
        isVirtual: false,
      },
    });
    expect(venueResponse.ok()).toBeTruthy();
    const venueData = await venueResponse.json();
    cleanup.venues.push(venueData.venue.id);

    const now = new Date();
    const futureEvent = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const currentRegOpens = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    const currentRegCloses = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

    const eventResponse = await request.post('/api/admin/event-v2', {
      headers: adminHeaders,
      data: {
        slug: eventSlug,
        eventTypeCode: eventTypeCode,
        venueId: venueData.venue.id,
        bookId: bookData.book.id,
        title: 'Lang Test Event',
        titleEn: 'Lang Test Event EN',
        eventDate: futureEvent.toISOString(),
        registrationOpensAt: currentRegOpens.toISOString(),
        registrationClosesAt: currentRegCloses.toISOString(),
        isPublished: true,
      },
    });
    expect(eventResponse.ok()).toBeTruthy();
    const eventData = await eventResponse.json();
    cleanup.events.push(eventData.event.id);

    // Navigate to signup page in English
    await page.goto(`/en/signup/${eventSlug}`, { waitUntil: 'networkidle' });

    // Step 1: Verify we're on intro page (step 0)
    await expect(page.locator('button:has-text("I Understand")')).toBeVisible({ timeout: 5000 });

    // Click to go to registration form (step 1)
    await page.click('button:has-text("I Understand")');
    await page.waitForTimeout(300);

    // Verify we're on the registration form
    await expect(page.locator('form')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Toggle to Chinese - should stay on registration form
    await page.click('a[aria-label*="Chinese" i]');
    await page.waitForTimeout(500);

    // Verify we're still on the registration form (not intro page)
    await expect(page.locator('form')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    // Verify intro button is NOT visible (proves we didn't flash back)
    await expect(page.locator('button:has-text("我了解")')).not.toBeVisible();

    // Fill some form fields and go to payment step (step 2)
    await page.fill('input[name="name"], input[placeholder*="name" i], input[placeholder*="稱呼" i]', 'Test User');
    await page.fill('input[name="age"], input[placeholder*="age" i], input[placeholder*="歲" i]', '25');
    await page.fill('input[name="profession"], input[placeholder*="do" i], input[placeholder*="工作" i]', 'Engineer');
    await page.fill('input[type="email"]', `test-${timestamp}@example.com`);
    await page.selectOption('select[name="referral"]', 'BookDigestIG');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Verify we're on the payment info page (step 2)
    const bankAccountInput = page.locator('input#bank-last-5');
    await expect(bankAccountInput).toBeVisible({ timeout: 5000 });

    // Toggle back to English - should stay on payment step
    await page.click('a[aria-label*="English" i]');
    await page.waitForTimeout(500);

    // Verify we're still on payment step (not form or intro)
    await expect(page.locator('input#bank-last-5')).toBeVisible({ timeout: 5000 });
    // Verify form is NOT visible (proves we didn't go back to step 1)
    await expect(page.locator('input[name="name"]')).not.toBeVisible();
    // Verify intro button is NOT visible (proves we didn't go back to step 0)
    await expect(page.locator('button:has-text("I Understand")')).not.toBeVisible();

    // Cleanup happens in afterEach
  });
});
