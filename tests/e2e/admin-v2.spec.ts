import { expect, test } from '@playwright/test';

test.describe('Admin v2 API - Happy flow', () => {
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

    // Then delete venues
    for (const venueId of cleanup.venues) {
      await request.delete(`/api/admin/venue-v2/${venueId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }

    // Finally delete books
    for (const bookId of cleanup.books) {
      await request.delete(`/api/admin/book-v2/${bookId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }
  });

  test('foreign key constraints prevent deleting venue when referenced by events (book can be deleted as it uses SET NULL)', async ({ request }) => {
    const timestamp = `${Date.now()}-fk-${Math.random().toString(36).slice(2, 9)}`;
    const bookSlug = `test-book-${timestamp}`;
    const venueSlug = `test-venue-${timestamp}`;
    const eventSlug = `test-event-${timestamp}`;
    const eventTypeCode = eventTypes[0].code;

    // Create a book
    const bookResponse = await request.post('/api/admin/book-v2', {
      headers: adminHeaders,
      data: {
        slug: bookSlug,
        title: 'FK Test Book',
        author: 'FK Test Author',
      },
    });
    expect(bookResponse.ok()).toBeTruthy();
    const bookData = await bookResponse.json();
    const bookId = bookData.book.id;
    cleanup.books.push(bookId);

    // Create a venue
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
    const venueId = venueData.venue.id;
    cleanup.venues.push(venueId);

    // Create an event linking to both
    const now = new Date();
    const futureEvent = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const futureRegOpens = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const futureRegCloses = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

    const eventResponse = await request.post('/api/admin/event-v2', {
      headers: adminHeaders,
      data: {
        slug: eventSlug,
        eventTypeCode: eventTypeCode,
        venueId: venueId,
        bookId: bookId,
        title: 'FK Test Event',
        eventDate: futureEvent.toISOString(),
        registrationOpensAt: futureRegOpens.toISOString(),
        registrationClosesAt: futureRegCloses.toISOString(),
        isPublished: true,
      },
    });
    expect(eventResponse.ok()).toBeTruthy();
    const eventData = await eventResponse.json();
    const eventId = eventData.event.id;
    cleanup.events.push(eventId);

    // Try to delete the book - should succeed because book_id uses ON DELETE SET NULL
    const deleteBookResponse = await request.delete(`/api/admin/book-v2/${bookId}`, {
      headers: adminHeaders,
    });
    expect(deleteBookResponse.ok()).toBeTruthy();
    cleanup.books = cleanup.books.filter(id => id !== bookId);

    // Verify event still exists but book_id is now null
    const getEventResponse = await request.get(`/api/admin/event-v2/${eventId}`, {
      headers: adminHeaders,
    });
    expect(getEventResponse.ok()).toBeTruthy();
    const eventCheck = await getEventResponse.json();
    expect(eventCheck.event.bookId).toBeUndefined(); // bookId should be null/undefined now

    // Try to delete the venue - should fail with FK constraint error (venue uses ON DELETE RESTRICT)
    const deleteVenueResponse = await request.delete(`/api/admin/venue-v2/${venueId}`, {
      headers: adminHeaders,
    });
    expect(deleteVenueResponse.ok()).toBeFalsy();
    expect(deleteVenueResponse.status()).toBe(500); // Server error due to FK constraint

    // Delete the event first
    const deleteEventResponse = await request.delete(`/api/admin/event-v2/${eventId}`, {
      headers: adminHeaders,
    });
    expect(deleteEventResponse.ok()).toBeTruthy();
    cleanup.events = cleanup.events.filter(id => id !== eventId);

    // Now we can successfully delete the venue
    const deleteVenueRetryResponse = await request.delete(`/api/admin/venue-v2/${venueId}`, {
      headers: adminHeaders,
    });
    expect(deleteVenueRetryResponse.ok()).toBeTruthy();
    cleanup.venues = cleanup.venues.filter(id => id !== venueId);
  });

  for (let typeIndex = 0; typeIndex < 10; typeIndex++) {
    test(`complete event lifecycle for event type ${typeIndex}: create book -> venue -> event -> test registration states -> cleanup`, async ({ page, request }) => {
      const eventTypeCode = eventTypes[typeIndex % eventTypes.length].code;
      const timestamp = `${Date.now()}-${typeIndex}-${Math.random().toString(36).slice(2, 9)}`;
      const bookSlug = `test-book-${timestamp}`;
      const venueSlug = `test-venue-${timestamp}`;
      const eventSlug = `test-event-${timestamp}`;

        // Step 1: Create a book
      const bookResponse = await request.post('/api/admin/book-v2', {
        headers: adminHeaders,
        data: {
          slug: bookSlug,
          title: 'Test Book Title',
          titleEn: 'Test Book Title EN',
          author: 'Test Author',
          authorEn: 'Test Author EN',
          summary: 'A test book for e2e testing',
          summaryEn: 'A test book for e2e testing EN',
        },
      });

      expect(bookResponse.ok()).toBeTruthy();
      const bookData = await bookResponse.json();
      expect(bookData.ok).toBe(true);
      expect(bookData.book).toBeDefined();
      expect(bookData.book.id).toBeGreaterThan(0);
      const bookId = bookData.book.id;
      cleanup.books.push(bookId);

      // Step 2: Create a venue
      const venueResponse = await request.post('/api/admin/venue-v2', {
        headers: adminHeaders,
        data: {
          name: venueSlug,
          location: 'TW',
          address: '123 Test Street, Taipei',
          maxCapacity: 30,
          isVirtual: false,
        },
      });

      expect(venueResponse.ok()).toBeTruthy();
      const venueData = await venueResponse.json();
      expect(venueData.ok).toBe(true);
      expect(venueData.venue).toBeDefined();
      expect(venueData.venue.id).toBeGreaterThan(0);
      const venueId = venueData.venue.id;
      cleanup.venues.push(venueId);

      // Step 3: Note - there's no server-side validation for illogical event times
      // The API allows any date combination, so we skip the "bad times" test

      // Step 4: Create event in the past (registration already ended)
      const now = new Date();
      const pastEventTime = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      const pastRegOpens = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      const pastRegCloses = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const futureEventTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const pastEventResponse = await request.post('/api/admin/event-v2', {
        headers: adminHeaders,
        data: {
          slug: eventSlug,
          eventTypeCode: eventTypeCode,
          venueId: venueId,
          bookId: bookId,
          title: 'Test Event - Past',
          titleEn: 'Test Event - Past EN',
          description: 'A test event in the past',
          descriptionEn: 'A test event in the past EN',
          eventDate: pastEventTime.toISOString(),
          registrationOpensAt: pastRegOpens.toISOString(),
          registrationClosesAt: pastRegCloses.toISOString(),
          isPublished: true,
        },
      });

      expect(pastEventResponse.ok()).toBeTruthy();
      const pastEventData = await pastEventResponse.json();
      expect(pastEventData.ok).toBe(true);
      expect(pastEventData.event).toBeDefined();
      const eventId = pastEventData.event.id;
      cleanup.events.push(eventId);

      // Visit the event signup page and verify "registration ended" state
      await page.goto(`/en/signup/${eventSlug}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('text=/Registration Closed|Event Ended/i').first()).toBeVisible({ timeout: 5000 });

      // Step 5: Modify event to future but registration also future (coming soon)
      const futureRegOpens = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
      const futureRegCloses = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000); // 6 days from now

      const futureEventResponse = await request.put(`/api/admin/event-v2/${eventId}`, {
        headers: adminHeaders,
        data: {
          eventDate: futureEventTime.toISOString(),
          registrationOpensAt: futureRegOpens.toISOString(),
          registrationClosesAt: futureRegCloses.toISOString(),
        },
      });

      expect(futureEventResponse.ok()).toBeTruthy();

      // Visit the event signup page and verify "coming soon" state (only title shown, no registration form)
      await page.goto(`/en/signup/${eventSlug}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1', { hasText: 'Test Event - Past EN' })).toBeVisible({ timeout: 5000 });
      // Verify registration form is NOT shown
      await expect(page.locator('form')).not.toBeVisible();

      // Step 6: Modify registration time to now (can register)
      const currentRegOpens = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
      const currentRegCloses = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000); // 6 days from now

      const openEventResponse = await request.put(`/api/admin/event-v2/${eventId}`, {
        headers: adminHeaders,
        data: {
          registrationOpensAt: currentRegOpens.toISOString(),
          registrationClosesAt: currentRegCloses.toISOString(),
        },
      });

      expect(openEventResponse.ok()).toBeTruthy();

      // Step 7: Test registration flow
      await page.goto(`/en/signup/${eventSlug}`, { waitUntil: 'networkidle' });

      // Step 7a: Payment intro page (step 0) - click "I Understand, Continue"
      await expect(page.locator('button:has-text("I Understand")')).toBeVisible({ timeout: 5000 });
      await page.click('button:has-text("I Understand")');
      await page.waitForTimeout(500);

      // Step 7b: Wait for the registration form to be visible (step 1)
      await expect(page.locator('form')).toBeVisible({ timeout: 5000 });

      // Step 7c: Fill in registration form - all required fields
      const testEmail = `test-${timestamp}@example.com`;
      await page.fill('input[name="name"], input[placeholder*="name" i]', 'Test User');
      await page.fill('input[name="age"], input[placeholder*="age" i]', '25');
      await page.fill('input[name="profession"], input[placeholder*="do" i]', 'Engineer');
      await page.fill('input[type="email"]', testEmail);
      await page.selectOption('select[name="referral"]', 'BookDigestIG');

      // Step 7d: Submit the form to go to bank account page (step 2)
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);

      // Step 7e: Fill in bank account field (5 digits) on step 2
      const testBankAccount = '12345';
      const bankAccountInput = page.locator('input#bank-last-5');
      await expect(bankAccountInput).toBeVisible({ timeout: 5000 });
      await bankAccountInput.fill(testBankAccount);

      // Step 7f: Submit payment to complete registration (step 3)
      await page.click('button:has-text("Submit")');

      // Wait for the registration request to complete
      await page.waitForResponse(response =>
        response.url().includes('/register') && response.status() === 201,
        { timeout: 10000 }
      );

      // Wait for React to re-render
      await page.waitForTimeout(1000);

      // Step 7g: Wait for success message - look for the h3 directly
      await expect(page.locator('h3:has-text("Registration Successful")')).toBeVisible({ timeout: 5000 });

      // Step 8: Verify registration was created via API
      // First check all registrations without filter
      const allRegistrationsResponse = await request.get(`/api/admin/registrations?limit=100`, {
        headers: adminHeaders,
      });
      const allRegistrationsData = await allRegistrationsResponse.json();
      console.log('Registration test - total registrations in system:', allRegistrationsData.items?.length || 0);

      const registrationsResponse = await request.get(`/api/admin/registrations?eventId=${eventId}`, {
        headers: adminHeaders,
      });

      if (!registrationsResponse.ok()) {
        console.log('Registrations API error:', registrationsResponse.status(), await registrationsResponse.text());
      }

      expect(registrationsResponse.ok()).toBeTruthy();
      const registrationsData = await registrationsResponse.json();
      console.log('Registration test - looking for email:', testEmail);
      console.log('Registration test - eventId filter:', eventId);
      console.log('Registration test - found items for this event:', registrationsData.items?.length || 0);
      if (registrationsData.items && registrationsData.items.length > 0) {
        console.log('Registration test - first item:', JSON.stringify(registrationsData.items[0], null, 2));
      }
      expect(registrationsData.items).toBeDefined();
      const registration = registrationsData.items.find((r: any) => r.email === testEmail);
      expect(registration).toBeDefined();
      expect(registration.name).toBe('Test User');
      // Verify bank account field is present and matches what we submitted
      expect(registration.bankAccount).toBe(testBankAccount);
      console.log('Registration test - bank account verified:', registration.bankAccount);

      // TODO: Also verify via admin dashboard UI
      // Currently the admin panel's Registrations tab doesn't properly render/update after clicking.
      // The button shows [active] but the content area still displays the Books editor instead of
      // the registrations list. This needs investigation into the admin panel's client-side
      // routing/state management. Once fixed, add UI verification back.

      // Cleanup will happen in afterEach
    });
  }

  test('event with missing cover image shows fallback placeholder', async ({ page, request }) => {
    const eventTypeCode = eventTypes[0].code;
    const timestamp = `${Date.now()}-img-${Math.random().toString(36).slice(2, 9)}`;
    const bookSlug = `test-book-${timestamp}`;
    const venueSlug = `test-venue-${timestamp}`;
    const eventSlug = `test-event-${timestamp}`;

    // Create book
    const bookResponse = await request.post('/api/admin/book-v2', {
      headers: adminHeaders,
      data: {
        slug: bookSlug,
        title: 'Missing Image Test Book',
        author: 'Test Author',
      },
    });
    expect(bookResponse.ok()).toBeTruthy();
    const bookData = await bookResponse.json();
    cleanup.books.push(bookData.book.id);

    // Create venue
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

    // Create event with non-existent coverUrl
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
        title: 'Missing Image Test Event',
        titleEn: 'Missing Image Test Event EN',
        coverUrl: '/images/events/non-existent-image.jpg', // Intentionally missing
        eventDate: futureEvent.toISOString(),
        registrationOpensAt: currentRegOpens.toISOString(),
        registrationClosesAt: currentRegCloses.toISOString(),
        isPublished: true,
      },
    });
    expect(eventResponse.ok()).toBeTruthy();
    const eventData = await eventResponse.json();
    cleanup.events.push(eventData.event.id);

    // Visit the signup page
    await page.goto(`/en/signup/${eventSlug}`, { waitUntil: 'networkidle' });

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Verify fallback placeholder is shown (check for the gradient div)
    const fallbackPlaceholder = page.locator('div.bg-gradient-to-br.from-brand-navy.to-brand-pink');
    await expect(fallbackPlaceholder).toBeVisible({ timeout: 5000 });

    // Verify the page still renders correctly
    await expect(page.locator('button:has-text("I Understand")')).toBeVisible({ timeout: 5000 });

    // Cleanup happens in afterEach
  });
});
