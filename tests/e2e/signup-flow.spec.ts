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
    // Delete in correct order due to foreign key constraints: registrations -> events -> venues -> books

    // First delete all registrations for the test events
    for (const eventId of cleanup.events) {
      await request.delete(`/api/admin/registrations-by-event/${eventId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }

    // Then delete events
    for (const eventId of cleanup.events) {
      await request.delete(`/api/admin/event-v2/${eventId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }

    // Venues are no longer separate entities - they're inline in events

    // Finally delete books
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
    const eventSlug = `test-event-${timestamp}`;

    // Create book and event
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

    const now = new Date();
    const futureEvent = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const currentRegOpens = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    const currentRegCloses = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

    const eventResponse = await request.post('/api/admin/event-v2', {
      headers: adminHeaders,
      data: {
        slug: eventSlug,
        eventTypeCode: eventTypeCode,
        bookId: bookData.book.id,
        title: 'Lang Test Event',
        titleEn: 'Lang Test Event EN',
        eventDate: futureEvent.toISOString(),
        registrationOpensAt: currentRegOpens.toISOString(),
        registrationClosesAt: currentRegCloses.toISOString(),
        isPublished: true,
        // Inline venue fields
        venueLocation: 'TW',
        venueCapacity: 20,
        venueName: `test-venue-${timestamp}`,
        paymentAmount: 300,
        paymentCurrency: 'TWD',
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

  test('event shows full and disabled button when capacity is reached', async ({ page, request }) => {
    const eventTypeCode = eventTypes[0].code;
    const timestamp = `${Date.now()}-capacity-${Math.random().toString(36).slice(2, 9)}`;
    const bookSlug = `test-book-${timestamp}`;
    const eventSlug = `test-event-${timestamp}`;

    // Create book
    const bookResponse = await request.post('/api/admin/book-v2', {
      headers: adminHeaders,
      data: {
        slug: bookSlug,
        title: 'Capacity Test Book',
        author: 'Capacity Test Author',
      },
    });
    expect(bookResponse.ok()).toBeTruthy();
    const bookData = await bookResponse.json();
    cleanup.books.push(bookData.book.id);

    const now = new Date();
    const futureEvent = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const currentRegOpens = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    const currentRegCloses = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

    // Create event with capacity of 1
    const eventResponse = await request.post('/api/admin/event-v2', {
      headers: adminHeaders,
      data: {
        slug: eventSlug,
        eventTypeCode: eventTypeCode,
        bookId: bookData.book.id,
        title: 'Capacity Test Event',
        titleEn: 'Capacity Test Event EN',
        eventDate: futureEvent.toISOString(),
        registrationOpensAt: currentRegOpens.toISOString(),
        registrationClosesAt: currentRegCloses.toISOString(),
        isPublished: true,
        // Inline venue fields with capacity of 1
        venueLocation: 'TW',
        venueCapacity: 1,
        venueName: `test-venue-${timestamp}`,
        paymentAmount: 300,
        paymentCurrency: 'TWD',
      },
    });
    expect(eventResponse.ok()).toBeTruthy();
    const eventData = await eventResponse.json();
    cleanup.events.push(eventData.event.id);

    // First: Navigate to events page and verify button shows "Sign Up"
    await page.goto(`/en/events/TW`, { waitUntil: 'networkidle' });

    // Find the event card and verify Sign Up button is visible and enabled
    const signUpButton = page.locator(`a[href="/en/signup/${eventSlug}"]`).first();
    await expect(signUpButton).toBeVisible({ timeout: 10000 });
    await expect(signUpButton).toBeEnabled();
    await expect(signUpButton).toContainText('Sign Up', { ignoreCase: true });

    // Second: Complete first registration to fill the event (capacity = 1)
    await page.goto(`/en/signup/${eventSlug}`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("I Understand")');
    await page.waitForTimeout(300);

    // Fill registration form
    await page.fill('input[name="name"]', 'First User');
    await page.fill('input[name="age"]', '30');
    await page.fill('input[name="profession"]', 'Tester');
    await page.fill('input[type="email"]', `first-${timestamp}@example.com`);
    await page.selectOption('select[name="referral"]', 'BookDigestIG');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Fill bank account and submit
    await page.fill('input#bank-last-5', '12345');
    // Wait for the submit button to be visible and click it
    const submitButton = page.locator('button:has-text("Submit")').last();
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();
    await page.waitForTimeout(1000);

    // Should see success message
    await expect(page.locator('text=/success|成功/i')).toBeVisible({ timeout: 10000 });

    // Manually navigate to events page to check Full button (no auto-redirect anymore)
    await page.goto(`/en/events/TW`, { waitUntil: 'networkidle' });

    // Page is now on events page - should show "Full" button that is disabled
    const fullButton = page.locator('button:has-text("Full")').first();
    await expect(fullButton).toBeVisible({ timeout: 10000 });
    await expect(fullButton).toBeDisabled();

    // Verify it has disabled styling (opacity-50 and cursor-not-allowed)
    await expect(fullButton).toHaveClass(/opacity-50/);
    await expect(fullButton).toHaveClass(/cursor-not-allowed/);

    // Fourth: Try to access signup page directly - should also show full/disabled state
    await page.goto(`/en/signup/${eventSlug}`, { waitUntil: 'networkidle' });

    // Should see a disabled state or error message indicating event is full
    const pageContent = await page.textContent('body');
    const isFullMessageShown =
      pageContent?.includes('full') ||
      pageContent?.includes('Full') ||
      pageContent?.includes('capacity') ||
      pageContent?.includes('已滿');

    expect(isFullMessageShown).toBeTruthy();

    // Cleanup happens in afterEach
  });
});
