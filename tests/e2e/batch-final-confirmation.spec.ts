import { test, expect } from '@playwright/test';

/**
 * E2E tests for Feature 3: Batch Final Confirmation Email
 * Tests the complete workflow from admin login to sending batch emails
 */

test.describe('Batch Final Confirmation Email', () => {
  const ADMIN_PASSWORD = 'test-admin';
  const adminHeaders = {
    'Authorization': 'Bearer test-admin',
  };

  let testEventId: number;
  let testEventSlug: string;
  let confirmedRegIds: string[] = [];
  let pendingRegIds: string[] = [];
  let bookId: number;

  test.beforeAll(async ({ request }, testInfo) => {
    const timestamp = Date.now();
    const workerId = testInfo.workerIndex;
    const bookSlug = `test-book-batch-${timestamp}-w${workerId}`;
    testEventSlug = `test-event-batch-${timestamp}-w${workerId}`;

    // Create a test book
    const bookResponse = await request.post('/api/admin/book-v2', {
      headers: adminHeaders,
      data: {
        slug: bookSlug,
        title: 'Test Book for Batch Email',
        author: 'Test Author',
      },
    });
    expect(bookResponse.ok()).toBeTruthy();
    const bookData = await bookResponse.json();
    bookId = bookData.book.id;

    // Create a test event
    const now = new Date();
    const futureEvent = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const futureRegOpens = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // Already open
    const futureRegCloses = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

    const eventResponse = await request.post('/api/admin/event-v2', {
      headers: adminHeaders,
      data: {
        slug: testEventSlug,
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        bookId: bookId,
        title: 'Test Event for Batch Email',
        eventDate: futureEvent.toISOString(),
        registrationOpensAt: futureRegOpens.toISOString(),
        registrationClosesAt: futureRegCloses.toISOString(),
        isPublished: true,
        venueLocation: 'TW',
        venueCapacity: 50,
        venueName: 'Test Venue',
        paymentAmount: 300,
        paymentCurrency: 'TWD',
        introTemplateName: 'default_paid',
      },
    });
    expect(eventResponse.ok()).toBeTruthy();
    const eventData = await eventResponse.json();
    testEventId = eventData.event.id;

    // Give time for event to be fully committed and indexed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create test registrations via public API
    // 3 confirmed registrations
    for (let i = 0; i < 3; i++) {
      const regResponse = await request.post(`/api/event/${testEventSlug}/register`, {
        data: {
          name: `Confirmed User ${i + 1}`,
          age: 25 + i,
          profession: 'Tester',
          email: `confirmed${i + 1}-${timestamp}@test.com`,
          referral: 'Instagram',
          locale: i % 2 === 0 ? 'zh' : 'en',
          bankAccount: '12345',
          turnstileToken: 'test-token',
        },
      });
      if (!regResponse.ok()) {
        const error = await regResponse.json();
        console.log('Registration failed:', JSON.stringify(error, null, 2));
      }
      expect(regResponse.ok()).toBeTruthy();
      const regData = await regResponse.json();
      confirmedRegIds.push(regData.id);
    }

    // Update those registrations to confirmed status
    for (const regId of confirmedRegIds) {
      await request.post(`/api/admin/registrations/${regId}/confirm-payment`, {
        headers: adminHeaders,
      });
    }

    // 1 pending registration (should not be selectable)
    const pendingResponse = await request.post(`/api/event/${testEventSlug}/register`, {
      data: {
        name: 'Pending User',
        age: 30,
        profession: 'Tester',
        email: `pending-${timestamp}@test.com`,
        referral: 'Facebook',
        locale: 'zh',
        bankAccount: '12345',
        turnstileToken: 'test-token',
      },
    });
    expect(pendingResponse.ok()).toBeTruthy();
    const pendingData = await pendingResponse.json();
    pendingRegIds.push(pendingData.id);
  });

  test.afterAll(async ({ request }) => {
    // Clean up: delete registrations, event, book
    if (testEventId) {
      await request.delete(`/api/admin/registrations-by-event/${testEventId}`, {
        headers: adminHeaders,
      }).catch(() => {});

      await request.delete(`/api/admin/event-v2/${testEventId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }

    if (bookId) {
      await request.delete(`/api/admin/book-v2/${bookId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }
  });

  test.beforeEach(async ({ page }) => {
    // Login to admin
    await page.goto('/admin/login');
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/admin/books');
  });

  test('should show checkboxes only when filtering by specific event', async ({ page }) => {
    await page.goto('/admin/registrations');

    // Initially "ALL" events selected - no checkboxes
    await expect(page.locator('input[type="checkbox"]').first()).not.toBeVisible();

    // Filter by our test event using event ID
    const eventDropdown = page.locator('select').first();
    await eventDropdown.selectOption(String(testEventId));

    // Search to load results
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(500);

    // Now checkboxes should appear
    const checkboxes = page.locator('tbody input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible();
  });

  test('should enable/disable checkboxes based on registration status', async ({ page }) => {
    await page.goto('/admin/registrations');

    // Filter to our test event
    const eventDropdown = page.locator('select').first();
    await eventDropdown.selectOption(String(testEventId));
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(500);

    // Check that confirmed registrations have enabled checkboxes
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    let confirmedCount = 0;
    let pendingCount = 0;

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const statusBadge = row.locator('span.rounded-full').first();
      const statusText = await statusBadge.textContent();
      const checkbox = row.locator('input[type="checkbox"]');

      if (statusText?.toLowerCase().includes('confirmed')) {
        await expect(checkbox).toBeEnabled();
        confirmedCount++;
      } else if (statusText?.toLowerCase().includes('pending')) {
        await expect(checkbox).toBeDisabled();
        pendingCount++;
      }
    }

    expect(confirmedCount).toBe(3);
    expect(pendingCount).toBe(1);
  });

  test('should select/deselect all confirmed registrations with header checkbox', async ({ page }) => {
    await page.goto('/admin/registrations');

    // Filter to our test event
    const eventDropdown = page.locator('select').first();
    await eventDropdown.selectOption(String(testEventId));
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(500);

    const headerCheckbox = page.locator('thead input[type="checkbox"]');
    const bodyCheckboxes = page.locator('tbody input[type="checkbox"]:not([disabled])');
    const checkboxCount = await bodyCheckboxes.count();
    expect(checkboxCount).toBe(3); // 3 confirmed registrations

    // Click header checkbox to select all
    await headerCheckbox.click();
    await page.waitForTimeout(200);

    // Verify all enabled checkboxes are checked
    for (let i = 0; i < checkboxCount; i++) {
      await expect(bodyCheckboxes.nth(i)).toBeChecked();
    }

    // Click header checkbox again to deselect all
    await headerCheckbox.click();
    await page.waitForTimeout(200);

    // Verify all checkboxes are unchecked
    for (let i = 0; i < checkboxCount; i++) {
      await expect(bodyCheckboxes.nth(i)).not.toBeChecked();
    }
  });

  test('should show "Send Final Confirmation" button only with valid selections', async ({ page }) => {
    await page.goto('/admin/registrations');

    // Filter to our test event
    const eventDropdown = page.locator('select').first();
    await eventDropdown.selectOption(String(testEventId));
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(500);

    const sendButton = page.locator('button:has-text("Send Final Confirmation")');

    // Initially disabled (no selections)
    await expect(sendButton).toBeDisabled();

    // Select a confirmed registration
    const confirmedCheckbox = page.locator('tbody tr').filter({
      has: page.locator('span:has-text("confirmed")')
    }).locator('input[type="checkbox"]').first();

    await confirmedCheckbox.click();
    await page.waitForTimeout(200);

    // Button should be enabled now
    await expect(sendButton).toBeEnabled();
    await expect(sendButton).toContainText('(1)');
  });

  test('should open modal with correct templates and event info', async ({ page }) => {
    await page.goto('/admin/registrations');

    // Filter and select registrations
    const eventDropdown = page.locator('select').first();
    await eventDropdown.selectOption(String(testEventId));
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(500);

    // Select all confirmed
    const headerCheckbox = page.locator('thead input[type="checkbox"]');
    await headerCheckbox.click();
    await page.waitForTimeout(200);

    // Click send button
    const sendButton = page.locator('button:has-text("Send Final Confirmation")');
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    // Modal should appear
    await expect(page.locator('h2:has-text("Send Final Confirmation")')).toBeVisible();

    // Check event info is displayed
    await expect(page.locator('strong:has-text("Event:")')).toBeVisible();
    await expect(page.locator('strong:has-text("Recipients:")')).toBeVisible();
    await expect(page.locator('text=3 confirmed registrations')).toBeVisible();

    // Check template fields exist
    await expect(page.locator('label:has-text("Subject (ZH)")')).toBeVisible();
    await expect(page.locator('label:has-text("Body (ZH)")')).toBeVisible();
    await expect(page.locator('label:has-text("Subject (EN)")')).toBeVisible();
    await expect(page.locator('label:has-text("Body (EN)")')).toBeVisible();

    // Check help text
    await expect(page.locator('text=Available variables:')).toBeVisible();
    await expect(page.locator('code:has-text("{{name}}")')).toBeVisible();

    // Close modal
    await page.click('button:has-text("Cancel")');
  });

  test('should persist template changes in sessionStorage', async ({ page }) => {
    await page.goto('/admin/registrations');

    // Filter and select registrations
    const eventDropdown = page.locator('select').first();
    await eventDropdown.selectOption(String(testEventId));
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(500);

    const headerCheckbox = page.locator('thead input[type="checkbox"]');
    await headerCheckbox.click();
    await page.waitForTimeout(200);

    const sendButton = page.locator('button:has-text("Send Final Confirmation")');
    await sendButton.click();

    // Edit templates
    const subjectInputZh = page.locator('input[type="text"]').first();
    await subjectInputZh.fill('Custom Subject ZH');
    await page.waitForTimeout(200);

    // Close modal
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(200);

    // Reopen modal
    await sendButton.click();
    await page.waitForTimeout(200);

    // Verify template persisted in sessionStorage
    await expect(subjectInputZh).toHaveValue('Custom Subject ZH');

    await page.click('button:has-text("Cancel")');
  });

  test('should send emails and show results', async ({ page }) => {
    await page.goto('/admin/registrations');

    // Filter to our test event
    const eventDropdown = page.locator('select').first();
    await eventDropdown.selectOption(String(testEventId));
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(500);

    // Select confirmed registrations
    const headerCheckbox = page.locator('thead input[type="checkbox"]');
    await headerCheckbox.click();
    await page.waitForTimeout(200);

    const sendButton = page.locator('button:has-text("Send Final Confirmation")');
    await sendButton.click();

    // Wait for modal and templates to load
    await page.waitForTimeout(500);

    // Templates should have default values, just click send
    const modalSendButton = page.locator('button:has-text("Send to")');
    await modalSendButton.click();

    // Wait for sending state
    await expect(page.locator('text=Sending emails')).toBeVisible();

    // Wait for results
    await expect(page.locator('text=Send Results')).toBeVisible({ timeout: 15000 });

    // Check results
    await expect(page.locator('text=Successfully sent')).toBeVisible();
    await expect(page.locator('text=Detailed Results')).toBeVisible();

    // Close and verify refresh
    await page.click('button:has-text("Close")');
    await page.waitForTimeout(500);

    // Verify registrations refreshed and selections cleared
    const checkboxes = page.locator('tbody input[type="checkbox"]:checked');
    expect(await checkboxes.count()).toBe(0);
  });

  test('should display status badges with correct colors', async ({ page }) => {
    await page.goto('/admin/registrations');

    // Filter to our test event
    const eventDropdown = page.locator('select').first();
    await eventDropdown.selectOption(String(testEventId));
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(500);

    // Check confirmed badge colors
    const confirmedBadge = page.locator('span.bg-blue-500\\/20').first();
    await expect(confirmedBadge).toBeVisible();
    await expect(confirmedBadge).toHaveClass(/bg-blue-500\/20/);
    await expect(confirmedBadge).toHaveClass(/text-blue-300/);

    // Filter by pending status
    const statusFilter = page.locator('select').nth(1);
    await statusFilter.selectOption('pending');
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(500);

    // Check pending badge (yellow, not gray based on the code)
    const pendingBadge = page.locator('span.bg-yellow-500\\/20').first();
    await expect(pendingBadge).toBeVisible();
  });

  test('should clear selections when changing filters', async ({ page }) => {
    await page.goto('/admin/registrations');

    // Select our test event and make selections
    const eventDropdown = page.locator('select').first();
    await eventDropdown.selectOption(String(testEventId));
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(500);

    const headerCheckbox = page.locator('thead input[type="checkbox"]');
    await headerCheckbox.click();
    await page.waitForTimeout(200);

    // Verify selections
    const checkedCount = await page.locator('tbody input[type="checkbox"]:checked').count();
    expect(checkedCount).toBeGreaterThan(0);

    // Change filter to ALL
    await eventDropdown.selectOption({ index: 0 });
    await page.waitForTimeout(200);

    // Verify selections cleared
    const newCheckedCount = await page.locator('tbody input[type="checkbox"]:checked').count();
    expect(newCheckedCount).toBe(0);
  });

  test('should show recipient count in button and modal', async ({ page }) => {
    await page.goto('/admin/registrations');

    const eventDropdown = page.locator('select').first();
    await eventDropdown.selectOption(String(testEventId));
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(500);

    // Select 2 registrations manually
    const checkboxes = page.locator('tbody input[type="checkbox"]:not([disabled])');

    await checkboxes.nth(0).click();
    await page.waitForTimeout(100);
    await checkboxes.nth(1).click();
    await page.waitForTimeout(100);

    const sendButton = page.locator('button:has-text("Send Final Confirmation")');

    // Button shows count
    await expect(sendButton).toContainText('(2)');

    // Open modal
    await sendButton.click();

    // Modal shows count
    await expect(page.locator('h2:has-text("2 recipients")')).toBeVisible();

    await page.click('button:has-text("Cancel")');
  });
});
