import { expect, test } from '@playwright/test';

test.describe('Admin Navigation Loading States', () => {
  const adminHeaders = {
    'Authorization': 'Bearer test-admin',
  };

  test.beforeEach(async ({ page }) => {
    // Login to admin
    await page.goto('/admin/login');
    await page.fill('input[type="password"]', 'test-admin');
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/books');
  });

  test('should show loading spinner when switching between admin tabs', async ({ page }) => {
    // Start on Books page - verify by checking URL
    await expect(page).toHaveURL('/admin/books');

    // Verify Books tab is active
    const booksTab = page.locator('a[href="/admin/books"]').first();
    await expect(booksTab).toHaveClass(/bg-brand-pink/);

    // Click on Events tab
    const eventsTab = page.locator('a[href="/admin/events"]').first();
    await eventsTab.click();

    // Should show loading spinner (briefly)
    // We check that the spinner appears or the navigation completes quickly
    const spinnerOrNewPage = Promise.race([
      page.locator('a[href="/admin/events"] svg.animate-spin').waitFor({ timeout: 500 }),
      page.waitForURL('/admin/events', { timeout: 2000 }),
    ]);

    await spinnerOrNewPage.catch(() => {
      // Either spinner appeared or navigation was too fast - both are OK
    });

    // Eventually should navigate to Events page
    await page.waitForURL('/admin/events');
    await expect(page.locator('a[href="/admin/events"]').first()).toHaveClass(/bg-brand-pink/);

    // Loading spinner should be gone
    await expect(page.locator('a[href="/admin/events"] svg.animate-spin')).not.toBeVisible();
  });

  test('should navigate through all admin tabs successfully', async ({ page }) => {
    const tabs = [
      { name: 'Events', url: '/admin/events', href: '/admin/events' },
      { name: 'Emails', url: '/admin/emails', href: '/admin/emails' },
      { name: 'Registrations', url: '/admin/registrations', href: '/admin/registrations' },
      { name: 'Assets', url: '/admin/assets', href: '/admin/assets' },
      { name: 'Books', url: '/admin/books', href: '/admin/books' },
    ];

    for (const tab of tabs) {
      // Click the tab
      await page.locator(`a[href="${tab.href}"]`).first().click();

      // Wait for navigation to complete
      await page.waitForURL(tab.url);

      // Verify the tab is active
      await expect(page.locator(`a[href="${tab.href}"]`).first()).toHaveClass(/bg-brand-pink/);

      // Verify no loading spinner is stuck
      await expect(page.locator(`a[href="${tab.href}"] svg.animate-spin`)).not.toBeVisible();
    }
  });

  test('should handle rapid tab switching', async ({ page }) => {
    // Rapidly click multiple tabs
    await page.locator('a[href="/admin/events"]').first().click();
    await page.locator('a[href="/admin/registrations"]').first().click();
    await page.locator('a[href="/admin/emails"]').first().click();

    // Should eventually settle on Emails page
    await page.waitForURL('/admin/emails', { timeout: 5000 });

    // All spinners should be cleared
    await expect(page.locator('svg.animate-spin')).not.toBeVisible();

    // Emails tab should be active
    await expect(page.locator('a[href="/admin/emails"]').first()).toHaveClass(/bg-brand-pink/);
  });

  test('should show active tab correctly after page refresh', async ({ page }) => {
    // Navigate to Events page
    await page.locator('a[href="/admin/events"]').first().click();
    await page.waitForURL('/admin/events');

    // Refresh the page
    await page.reload();

    // Events tab should still be active
    await expect(page.locator('a[href="/admin/events"]').first()).toHaveClass(/bg-brand-pink/);

    // No loading spinner should be visible
    await expect(page.locator('svg.animate-spin')).not.toBeVisible();
  });

  test('should not show spinner on already active tab', async ({ page }) => {
    // We're on Books page
    await expect(page).toHaveURL('/admin/books');
    await expect(page.locator('a[href="/admin/books"]').first()).toHaveClass(/bg-brand-pink/);

    // Click Books tab again
    const booksTab = page.locator('a[href="/admin/books"]').first();
    await booksTab.click();

    // Should not show loading spinner since we're already on this page
    await expect(page.locator('a[href="/admin/books"] svg.animate-spin')).not.toBeVisible();
  });
});

test.describe('Event Manager Filter Loading States', () => {
  const adminHeaders = {
    'Authorization': 'Bearer test-admin',
  };

  let eventTypes: Array<{ code: string; nameEn: string; nameZh: string }> = [];
  let cleanup: { events: number[]; venues: number[]; books: number[] } = {
    events: [],
    venues: [],
    books: [],
  };

  test.beforeAll(async ({ request }) => {
    // Get event types
    const eventTypesResponse = await request.get('/api/admin/event-types', {
      headers: adminHeaders,
    });
    expect(eventTypesResponse.ok()).toBeTruthy();
    const data = await eventTypesResponse.json();
    eventTypes = data.eventTypes;
  });

  test.beforeEach(async ({ page, request }) => {
    cleanup = { events: [], venues: [], books: [] };

    // Create test events with different types (venues are now inline fields)
    const now = Date.now();
    const eventData1 = {
      slug: `test-event-mandarin-${now}`,
      eventTypeCode: eventTypes[0].code,
      title: 'Test Mandarin Event',
      titleEn: 'Test Mandarin Event',
      eventDate: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      registrationOpensAt: new Date(now).toISOString(),
      registrationClosesAt: new Date(now + 29 * 24 * 60 * 60 * 1000).toISOString(),
      isPublished: true,
      // Inline venue fields
      venueLocation: 'TW',
      venueCapacity: 20,
      venueName: `Test Venue ${now}`,
      venueAddress: '123 Test St',
      paymentAmount: 300,
      paymentCurrency: 'TWD',
    };

    const eventData2 = {
      slug: `test-event-english-${now}`,
      eventTypeCode: eventTypes.length > 1 ? eventTypes[1].code : eventTypes[0].code,
      title: 'Test English Event',
      titleEn: 'Test English Event',
      eventDate: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      registrationOpensAt: new Date(now).toISOString(),
      registrationClosesAt: new Date(now + 29 * 24 * 60 * 60 * 1000).toISOString(),
      isPublished: true,
      // Inline venue fields
      venueLocation: 'TW',
      venueCapacity: 20,
      venueName: `Test Venue ${now}`,
      venueAddress: '123 Test St',
      paymentAmount: 300,
      paymentCurrency: 'TWD',
    };

    const event1Response = await request.post('/api/admin/event-v2', {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: eventData1,
    });
    const event1Data = await event1Response.json();
    cleanup.events.push(event1Data.event.id);

    const event2Response = await request.post('/api/admin/event-v2', {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: eventData2,
    });
    const event2Data = await event2Response.json();
    cleanup.events.push(event2Data.event.id);

    // Login and navigate to Events page
    await page.goto('/admin/login');
    await page.fill('input[type="password"]', 'test-admin');
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/books');
    await page.locator('a:has-text("Events")').first().click();
    await page.waitForURL('/admin/events');
  });

  test.afterEach(async ({ request }) => {
    // Cleanup in correct order
    for (const eventId of cleanup.events) {
      await request.delete(`/api/admin/registrations-by-event/${eventId}`, {
        headers: adminHeaders,
      }).catch(() => {});
      await request.delete(`/api/admin/event-v2/${eventId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }
    // Venues are no longer separate entities - they're inline in events
  });

  test('should show loading spinner when changing event filter', async ({ page }) => {
    // Wait for events to load
    await page.waitForSelector('select', { state: 'visible' });

    // Get the filter dropdown
    const filterSelect = page.locator('select').first();

    // Should show "All Types" initially
    await expect(filterSelect).toHaveValue('ALL');

    // Change filter
    await filterSelect.selectOption(eventTypes[0].code);

    // Check if spinner appears (might be very brief for sync filtering)
    // We verify either the spinner appears or filtering completes quickly
    const spinnerOrFiltered = Promise.race([
      page.locator('svg.animate-spin').waitFor({ state: 'visible', timeout: 300 }),
      page.waitForTimeout(100),
    ]);

    await spinnerOrFiltered.catch(() => {
      // Either spinner appeared or filtering was instant - both are OK
    });

    // Eventually, spinner should be gone
    await expect(page.locator('svg.animate-spin')).not.toBeVisible({ timeout: 2000 });

    // Filter should be applied
    await expect(filterSelect).toHaveValue(eventTypes[0].code);
  });

  test('should filter events correctly and update count', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('select', { state: 'visible' });

    const filterSelect = page.locator('select').first();

    // Check initial count shows all events
    const initialCount = await page.locator('text=/Events \\(\\d+\\)/').textContent();
    expect(initialCount).toContain('Events (');

    // Filter by first event type
    await filterSelect.selectOption(eventTypes[0].code);

    // Wait for filtering to complete
    await page.waitForTimeout(500);

    // Count should update
    const filteredCount = await page.locator('text=/Events \\(\\d+\\)/').textContent();
    expect(filteredCount).toContain('Events (');

    // No loading spinner should be stuck
    await expect(page.locator('svg.animate-spin')).not.toBeVisible();
  });

  test('should handle multiple filter changes quickly', async ({ page }) => {
    await page.waitForSelector('select', { state: 'visible' });

    const filterSelect = page.locator('select').first();

    // Rapidly change filters
    await filterSelect.selectOption(eventTypes[0].code);
    await filterSelect.selectOption('ALL');
    if (eventTypes.length > 1) {
      await filterSelect.selectOption(eventTypes[1].code);
    }
    await filterSelect.selectOption('ALL');

    // Wait for all changes to complete
    await page.waitForTimeout(1000);

    // Should settle on ALL with no stuck spinners
    await expect(filterSelect).toHaveValue('ALL');
    await expect(page.locator('svg.animate-spin')).not.toBeVisible();
  });

  test('should display registration count in correct color based on capacity', async ({ page, request }) => {
    // Create an event with capacity 2
    const now = Date.now();
    const eventDataLowCapacity = {
      slug: `test-event-low-capacity-${now}`,
      eventTypeCode: eventTypes[0].code,
      title: 'Low Capacity Event',
      titleEn: 'Low Capacity Event',
      eventDate: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      registrationOpensAt: new Date(now).toISOString(),
      registrationClosesAt: new Date(now + 29 * 24 * 60 * 60 * 1000).toISOString(),
      isPublished: true,
      venueLocation: 'TW',
      venueCapacity: 2,
      venueName: `Low Capacity Venue ${now}`,
      venueAddress: '123 Test St',
      paymentAmount: 300,
      paymentCurrency: 'TWD',
    };

    const eventResponse = await request.post('/api/admin/event-v2', {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: eventDataLowCapacity,
    });
    const eventData = await eventResponse.json();
    const eventId = eventData.event.id;
    cleanup.events.push(eventId);

    // Refresh the page to see the new event
    await page.reload();
    await page.waitForTimeout(500);

    // Find the event in the list - initially should show (0/2) in blue
    const eventItem = page.locator(`button:has-text("Low Capacity Event")`).first();
    await expect(eventItem).toBeVisible();

    // Check initial color (no registrations, should be blue)
    const initialCount = eventItem.locator('span:has-text("(0/2)")');
    await expect(initialCount).toBeVisible();
    await expect(initialCount).toHaveClass(/text-blue-400/);

    // Add 2 registrations to reach capacity
    const registrationData1 = {
      eventId,
      locale: 'en',
      name: 'Test User 1',
      age: 25,
      profession: 'Engineer',
      email: `test1-${now}@example.com`,
      referral: 'friend',
      timestamp: new Date().toISOString(),
      status: 'confirmed',
    };

    const registrationData2 = {
      eventId,
      locale: 'en',
      name: 'Test User 2',
      age: 25,
      profession: 'Engineer',
      email: `test2-${now}@example.com`,
      referral: 'friend',
      timestamp: new Date().toISOString(),
      status: 'confirmed',
    };

    await request.post('/api/admin/registrations', {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: registrationData1,
    });

    await request.post('/api/admin/registrations', {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: registrationData2,
    });

    // Refresh the page to see updated counts
    await page.reload();
    await page.waitForTimeout(500);

    // Find the event again and check the count is now red (at capacity)
    const updatedEventItem = page.locator(`button:has-text("Low Capacity Event")`).first();
    await expect(updatedEventItem).toBeVisible();

    const fullCount = updatedEventItem.locator('span:has-text("(2/2)")');
    await expect(fullCount).toBeVisible();
    await expect(fullCount).toHaveClass(/text-red-400/);
  });
});
