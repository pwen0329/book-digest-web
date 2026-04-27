/**
 * Email E2E Tests
 *
 * Comprehensive email notification testing with MailHog SMTP server.
 * Tests use API for admin operations and UI only for registration flow.
 *
 * Test Coverage:
 * 1. Registration Confirmation + Payment Confirmation (Happy Path)
 *    - EN locale: Creates event, registers user, confirms payment
 *    - ZH locale: Same flow with Chinese content
 * 2. Admin Test Email
 *    - EN locale: Admin sends test payment confirmation email
 *    - ZH locale: Admin sends test email in Chinese
 * 3. Cancellation Email
 *    - EN locale: Admin cancels registration with email notification
 *    - ZH locale: Cancellation with Chinese email content
 * 4. Negative Test: Confirms no email when notifications disabled
 *
 * Requirements:
 * - MailHog running (docker-compose up -d mailhog OR in CI as service)
 * - Supabase running locally (npx supabase start OR in CI)
 * - SMTP_HOST=localhost, SMTP_PORT=1025
 * - MAILHOG_API_URL=http://localhost:8025/api/v2
 *
 * CI runs these tests against local stack (Supabase + MailHog + Next.js)
 * instead of Vercel preview to allow proper email testing.
 */
import { test, expect } from '@playwright/test';
import { clearMailHogMessages, waitForEmail, getMailHogMessages, findEmailByRecipient } from './helpers/mailhog';

test.describe.configure({ mode: 'serial' });

test.describe('Email notifications', () => {
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
    // Fetch available event types
    const eventTypesResponse = await request.get('/api/admin/event-types', {
      headers: adminHeaders,
    });
    expect(eventTypesResponse.ok()).toBeTruthy();
    const data = await eventTypesResponse.json();
    eventTypes = data.eventTypes;
    expect(eventTypes.length).toBeGreaterThan(0);
  });

  test.beforeEach(async () => {
    // Clear MailHog messages before each test
    await clearMailHogMessages();
    cleanup = { events: [], venues: [], books: [] };
  });

  test.afterEach(async ({ request }) => {
    // Clean up test resources
    for (const eventId of cleanup.events) {
      await request.delete(`/api/admin/registrations-by-event/${eventId}`, {
        headers: adminHeaders,
      }).catch(() => {});
      await request.delete(`/api/admin/event-v2/${eventId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }
    // Venues are no longer separate entities - they're inline in events
    for (const bookId of cleanup.books) {
      await request.delete(`/api/admin/book-v2/${bookId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }

    // Clear MailHog after each test
    await clearMailHogMessages().catch(() => {});
  });

  // ============================================================================
  // Helper function to create test event
  // ============================================================================
  async function createTestEvent(request: any, slug: string, title: string, titleEn: string) {
    const timestamp = Date.now();

    // Create event with inline venue fields
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const registrationOpensAt = new Date();
    registrationOpensAt.setHours(registrationOpensAt.getHours() - 1); // Opens 1 hour ago
    const registrationClosesAt = new Date();
    registrationClosesAt.setDate(registrationClosesAt.getDate() + 5);

    const eventResponse = await request.post('/api/admin/event-v2', {
      headers: adminHeaders,
      data: {
        slug,
        title,
        titleEn,
        eventTypeCode: eventTypes[0].code,
        eventDate: futureDate.toISOString(),
        registrationOpensAt: registrationOpensAt.toISOString(),
        registrationClosesAt: registrationClosesAt.toISOString(),
        isPublished: true,
        // Inline venue fields
        venueLocation: 'TW',
        venueCapacity: 50,
        venueName: `Test Venue ${timestamp}`,
        paymentAmount: 300,
        paymentCurrency: 'TWD',
      },
    });
    expect(eventResponse.ok()).toBeTruthy();
    const event = await eventResponse.json();
    cleanup.events.push(event.event.id);

    return event.event;
  }

  // ============================================================================
  // 1. Happy Path: Registration → Payment Confirmation (Both Locales)
  // ============================================================================

  test('should send registration confirmation and payment confirmation emails (EN locale)', async ({ page, request }) => {
    const timestamp = Date.now();
    const testEmail = `test-en-${timestamp}@example.com`;
    const testName = 'Test User EN';
    const eventSlug = `test-event-en-${timestamp}`;

    // Enable email notifications via API
    const emailSettingsResponse = await request.put('/api/admin/settings/email', {
      headers: adminHeaders,
      data: { registrationEmailEnabled: true },
    });
    expect(emailSettingsResponse.ok()).toBeTruthy();

    // Create event via API
    const event = await createTestEvent(request, eventSlug, '測試活動', 'Test Event EN');

    // Submit registration via UI (EN locale)
    await page.goto(`/en/signup/${eventSlug}`, { waitUntil: 'networkidle' });

    // Step 1: Click "I Understand" button on intro page
    await expect(page.locator('button:has-text("I Understand")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("I Understand")');
    await page.waitForTimeout(500);

    // Step 2: Fill registration form
    await expect(page.locator('form')).toBeVisible({ timeout: 5000 });
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="age"]', '25');
    await page.fill('input[name="profession"]', 'Engineer');
    await page.fill('input[type="email"]', testEmail);
    await page.selectOption('select[name="referral"]', 'BookDigestIG');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Step 3: Fill bank account field
    const bankAccountInput = page.locator('input#bank-last-5');
    await expect(bankAccountInput).toBeVisible({ timeout: 5000 });
    await bankAccountInput.fill('12345');

    // Step 4: Submit final registration
    const submitButton = page.locator('button:has-text("Submit")');
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();
    await expect(page.locator('h3:has-text("Registration Successful")')).toBeVisible({ timeout: 10000 });

    // Wait for registration confirmation email
    const confirmationEmail = await waitForEmail(testEmail, { timeout: 15000 });
    expect(confirmationEmail).toBeDefined();
    expect(confirmationEmail.Content.Headers.Subject[0]).toContain('Registration');
    expect(confirmationEmail.Content.Body).toContain(testName);
    expect(confirmationEmail.Content.Body).toContain('Test Event EN');
    // Verify bank account last 5 digits appears in email
    expect(confirmationEmail.Content.Body).toContain('12345');

    // Clear MailHog for next email
    await clearMailHogMessages();

    // Get registration ID and confirm payment via API
    const registrationsResponse = await request.get(`/api/admin/registrations?eventId=${event.id}`, {
      headers: adminHeaders,
    });
    expect(registrationsResponse.ok()).toBeTruthy();
    const registrations = await registrationsResponse.json();
    expect(registrations.items.length).toBeGreaterThan(0);
    const registrationId = registrations.items[0].id;

    const confirmPaymentResponse = await request.post(`/api/admin/registrations/${registrationId}/confirm-payment`, {
      headers: adminHeaders,
      data: {},
    });
    expect(confirmPaymentResponse.ok()).toBeTruthy();

    // Wait for payment confirmation email
    const paymentEmail = await waitForEmail(testEmail, { timeout: 15000 });
    expect(paymentEmail).toBeDefined();
    expect(paymentEmail.Content.Headers.Subject[0]).toContain('Payment');
    expect(paymentEmail.Content.Body).toContain(testName);
    expect(paymentEmail.Content.Body).toContain('Test Event EN');
  });

  test('should send registration confirmation and payment confirmation emails (ZH locale)', async ({ page, request }) => {
    const timestamp = Date.now();
    const testEmail = `test-zh-${timestamp}@example.com`;
    const testName = '測試使用者';
    const eventSlug = `test-event-zh-${timestamp}`;

    // Enable email notifications via API
    await request.put('/api/admin/settings/email', {
      headers: adminHeaders,
      data: { registrationEmailEnabled: true },
    });

    // Create event via API
    const event = await createTestEvent(request, eventSlug, '測試活動 ZH', 'Test Event ZH');

    // Submit registration via UI (ZH locale)
    await page.goto(`/zh/signup/${eventSlug}`, { waitUntil: 'networkidle' });

    // Step 1: Click "我了解，繼續報名" button on intro page
    await expect(page.locator('button:has-text("我了解，繼續報名")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("我了解，繼續報名")');
    await page.waitForTimeout(500);

    // Step 2: Fill registration form
    await expect(page.locator('form')).toBeVisible({ timeout: 5000 });
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="age"]', '25');
    await page.fill('input[name="profession"]', '工程師');
    await page.fill('input[type="email"]', testEmail);
    await page.selectOption('select[name="referral"]', 'BookDigestIG');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Step 3: Fill bank account field
    const bankAccountInput = page.locator('input#bank-last-5');
    await expect(bankAccountInput).toBeVisible({ timeout: 5000 });
    await bankAccountInput.fill('12345');
    await page.waitForTimeout(500);

    // Step 4: Submit final registration
    const submitButton = page.locator('button:has-text("提交")');
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();
    await expect(page.locator('h3:has-text("報名成功")')).toBeVisible({ timeout: 10000 });

    // Wait for registration confirmation email (ZH)
    const confirmationEmail = await waitForEmail(testEmail, { timeout: 15000 });
    expect(confirmationEmail).toBeDefined();
    // Subject might be RFC 2047 encoded, so check for encoded or decoded forms
    const subject = confirmationEmail.Content.Headers.Subject[0];
    expect(subject).toMatch(/報名|Registration|=E5=A0=B1=E5=90=8D/i);
    expect(confirmationEmail.Content.Body).toContain(testName);
    // Verify bank account last 5 digits appears in email
    expect(confirmationEmail.Content.Body).toContain('12345');

    await clearMailHogMessages();

    // Confirm payment via API
    const registrationsResponse = await request.get(`/api/admin/registrations?eventId=${event.id}`, {
      headers: adminHeaders,
    });
    const registrations = await registrationsResponse.json();
    const registrationId = registrations.items[0].id;

    await request.post(`/api/admin/registrations/${registrationId}/confirm-payment`, {
      headers: adminHeaders,
      data: {},
    });

    // Wait for payment confirmation email (ZH)
    const paymentEmail = await waitForEmail(testEmail, { timeout: 15000 });
    expect(paymentEmail).toBeDefined();
    // Subject might be RFC 2047 encoded
    const paymentSubject = paymentEmail.Content.Headers.Subject[0];
    expect(paymentSubject).toMatch(/付款|Payment|=E4=BB=98=E6=AC=BE/i);
  });

  // ============================================================================
  // 2. Admin Test Email (Both Locales)
  // ============================================================================

  test('should send test email from admin (EN locale)', async ({ request }) => {
    const testEmail = `admin-test-en-${Date.now()}@example.com`;
    const eventSlug = `test-event-admin-en-${Date.now()}`;

    // Create event via API
    const event = await createTestEvent(request, eventSlug, '管理員測試活動', 'Admin Test Event EN');

    // Send test email via API
    const testEmailResponse = await request.post('/api/admin/send-email', {
      headers: adminHeaders,
      data: {
        eventId: event.id,
        emailType: 'payment_confirmation',
        recipientEmail: testEmail,
        recipientLocale: 'en',
      },
    });
    expect(testEmailResponse.ok()).toBeTruthy();

    // Wait for test email
    const testEmailReceived = await waitForEmail(testEmail, { timeout: 15000 });
    expect(testEmailReceived).toBeDefined();
    expect(testEmailReceived.Content.Headers.Subject[0]).toContain('Payment');
    expect(testEmailReceived.Content.Body).toContain('Admin Test Event EN');
  });

  test('should send test email from admin (ZH locale)', async ({ request }) => {
    const testEmail = `admin-test-zh-${Date.now()}@example.com`;
    const eventSlug = `test-event-admin-zh-${Date.now()}`;

    // Create event via API
    const event = await createTestEvent(request, eventSlug, '管理員測試活動 ZH', 'Admin Test Event ZH');

    // Send test email via API (ZH locale)
    const testEmailResponse = await request.post('/api/admin/send-email', {
      headers: adminHeaders,
      data: {
        eventId: event.id,
        emailType: 'payment_confirmation',
        recipientEmail: testEmail,
        recipientLocale: 'zh',
      },
    });
    expect(testEmailResponse.ok()).toBeTruthy();

    // Wait for test email (ZH)
    const testEmailReceived = await waitForEmail(testEmail, { timeout: 15000 });
    expect(testEmailReceived).toBeDefined();
    // Subject might be RFC 2047 encoded with base64
    const subject = testEmailReceived.Content.Headers.Subject[0];
    expect(subject).toMatch(/付款|Payment|5LuY5qy+/i);
  });

  // ============================================================================
  // 3. Cancellation Email (Both Locales)
  // ============================================================================

  test('should send cancellation email (EN locale)', async ({ page, request }) => {
    const timestamp = Date.now();
    const testEmail = `cancel-en-${timestamp}@example.com`;
    const testName = 'Cancel Test User EN';
    const eventSlug = `test-event-cancel-en-${timestamp}`;

    // Enable email notifications and create event
    await request.put('/api/admin/settings/email', {
      headers: adminHeaders,
      data: { registrationEmailEnabled: true },
    });
    const event = await createTestEvent(request, eventSlug, '取消測試活動', 'Cancel Test Event EN');

    // Register for the event
    await page.goto(`/en/signup/${eventSlug}`, { waitUntil: 'networkidle' });

    // Step 1: Click "I Understand" button on intro page
    await expect(page.locator('button:has-text("I Understand")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("I Understand")');
    await page.waitForTimeout(500);

    // Step 2: Fill registration form
    await expect(page.locator('form')).toBeVisible({ timeout: 5000 });
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="age"]', '25');
    await page.fill('input[name="profession"]', 'Engineer');
    await page.fill('input[type="email"]', testEmail);
    await page.selectOption('select[name="referral"]', 'BookDigestIG');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Step 3: Fill bank account field
    const bankAccountInput = page.locator('input#bank-last-5');
    await expect(bankAccountInput).toBeVisible({ timeout: 5000 });
    await bankAccountInput.fill('12345');

    // Step 4: Submit final registration
    const submitButton = page.locator('button:has-text("Submit")');
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();
    await expect(page.locator('h3:has-text("Registration Successful")')).toBeVisible({ timeout: 10000 });

    // Clear registration confirmation email
    await clearMailHogMessages();

    // Get registration ID and cancel with email via API
    const registrationsResponse = await request.get(`/api/admin/registrations?eventId=${event.id}`, {
      headers: adminHeaders,
    });
    const registrations = await registrationsResponse.json();
    const registrationId = registrations.items[0].id;

    await request.post(`/api/admin/registrations/${registrationId}/cancel`, {
      headers: adminHeaders,
      data: {
        emailContent: 'Unfortunately, we need to cancel your registration. We apologize for the inconvenience.',
        emailSubject: 'Registration Cancelled - Cancel Test Event EN',
      },
    });

    // Wait for cancellation email
    const cancellationEmail = await waitForEmail(testEmail, { timeout: 15000 });
    expect(cancellationEmail).toBeDefined();
    expect(cancellationEmail.Content.Headers.Subject[0]).toContain('Cancelled');
    expect(cancellationEmail.Content.Body).toContain('cancel your registration');
  });

  test('should send cancellation email (ZH locale)', async ({ page, request }) => {
    const timestamp = Date.now();
    const testEmail = `cancel-zh-${timestamp}@example.com`;
    const testName = '取消測試使用者';
    const eventSlug = `test-event-cancel-zh-${timestamp}`;

    // Enable email and create event
    await request.put('/api/admin/settings/email', {
      headers: adminHeaders,
      data: { registrationEmailEnabled: true },
    });
    const event = await createTestEvent(request, eventSlug, '取消測試活動 ZH', 'Cancel Test Event ZH');

    // Register for the event
    await page.goto(`/zh/signup/${eventSlug}`, { waitUntil: 'networkidle' });

    // Step 1: Click "我了解，繼續報名" button on intro page
    await expect(page.locator('button:has-text("我了解，繼續報名")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("我了解，繼續報名")');
    await page.waitForTimeout(500);

    // Step 2: Fill registration form
    await expect(page.locator('form')).toBeVisible({ timeout: 5000 });
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="age"]', '25');
    await page.fill('input[name="profession"]', '工程師');
    await page.fill('input[type="email"]', testEmail);
    await page.selectOption('select[name="referral"]', 'BookDigestIG');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Step 3: Fill bank account field
    const bankAccountInput = page.locator('input#bank-last-5');
    await expect(bankAccountInput).toBeVisible({ timeout: 5000 });
    await bankAccountInput.fill('12345');
    await page.waitForTimeout(500);

    // Step 4: Submit final registration
    const submitButton = page.locator('button:has-text("提交")');
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();
    await expect(page.locator('h3:has-text("報名成功")')).toBeVisible({ timeout: 10000 });

    await clearMailHogMessages();

    // Cancel with email via API (Chinese content)
    const registrationsResponse = await request.get(`/api/admin/registrations?eventId=${event.id}`, {
      headers: adminHeaders,
    });
    const registrations = await registrationsResponse.json();
    const registrationId = registrations.items[0].id;

    await request.post(`/api/admin/registrations/${registrationId}/cancel`, {
      headers: adminHeaders,
      data: {
        emailContent: '很抱歉，我們需要取消您的報名。造成不便，敬請見諒。',
        emailSubject: '報名已取消 - 取消測試活動 ZH',
      },
    });

    // Wait for cancellation email (ZH)
    const cancellationEmail = await waitForEmail(testEmail, { timeout: 15000 });
    expect(cancellationEmail).toBeDefined();
    // Subject might be RFC 2047 encoded with base64
    const cancellationSubject = cancellationEmail.Content.Headers.Subject[0];
    expect(cancellationSubject).toMatch(/取消|已取消|5Y+W5raI/i);
    expect(cancellationEmail.Content.Body).toContain('取消您的報名');
  });

  // ============================================================================
  // 4. Negative Test: Email Disabled
  // ============================================================================

  test('should not send email when notifications are disabled', async ({ page, request }) => {
    const timestamp = Date.now();
    const testEmail = `no-email-${timestamp}@example.com`;
    const testName = 'No Email User';
    const eventSlug = `test-event-no-email-${timestamp}`;

    // Clear MailHog before test to ensure clean state
    await clearMailHogMessages();

    // Disable email notifications via API
    await request.put('/api/admin/settings/email', {
      headers: adminHeaders,
      data: { registrationEmailEnabled: false },
    });

    // Create event via API
    await createTestEvent(request, eventSlug, '無郵件測試活動', 'No Email Test Event');

    // Submit registration
    await page.goto(`/en/signup/${eventSlug}`, { waitUntil: 'networkidle' });

    // Step 1: Click "I Understand" button on intro page
    await expect(page.locator('button:has-text("I Understand")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("I Understand")');
    await page.waitForTimeout(500);

    // Step 2: Fill registration form
    await expect(page.locator('form')).toBeVisible({ timeout: 5000 });
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="age"]', '25');
    await page.fill('input[name="profession"]', 'Engineer');
    await page.fill('input[type="email"]', testEmail);
    await page.selectOption('select[name="referral"]', 'BookDigestIG');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Step 3: Fill bank account field
    const bankAccountInput = page.locator('input#bank-last-5');
    await expect(bankAccountInput).toBeVisible({ timeout: 5000 });
    await bankAccountInput.fill('12345');

    // Step 4: Submit final registration
    const submitButton = page.locator('button:has-text("Submit")');
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();
    await expect(page.locator('h3:has-text("Registration Successful")')).toBeVisible({ timeout: 10000 });

    // Wait a bit and verify no email was sent to this specific user
    await page.waitForTimeout(5000);
    const email = await findEmailByRecipient(testEmail);
    expect(email).toBeNull();
  });
});
