import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

type BookRecord = {
  id: string | number;
  slug: string;
  title: string;
  titleEn?: string;
  sortOrder?: number;
  [key: string]: unknown;
};

type EventContentMap = {
  TW: { title: { en: string } };
  NL: { title: { en: string } };
  EN: { title: { en: string } };
  DETOX: { title: { en: string } };
};

type CapacityConfigFile = {
  TW: { enabled: boolean; forceFull: boolean; startAt: string; endAt: string; max: number };
  NL: { enabled: boolean; forceFull: boolean; startAt: string; endAt: string; max: number };
  EN: { enabled: boolean; forceFull: boolean; startAt: string; endAt: string; max: number };
  DETOX: { enabled: boolean; forceFull: boolean; startAt: string; endAt: string; max: number };
};

type RegistrationSuccessEmailSettings = {
  enabled: boolean;
  templates: {
    zh: { subject: string; body: string };
    en: { subject: string; body: string };
  };
};

type EmailOutboxRecord = {
  to: string;
  subject: string;
  text: string;
  locale: 'zh' | 'en';
  location: 'TW' | 'NL' | 'EN' | 'DETOX';
  transport: 'file' | 'resend';
};

const adminHeaders = {
  Authorization: 'Bearer test-admin',
};

test.describe.configure({ timeout: 60_000 });

function toInputDate(value: Date) {
  const pad = (segment: number) => String(segment).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

async function readAdminState<T>(request: APIRequestContext, path: string, key: string): Promise<T> {
  const response = await request.get(path, { headers: adminHeaders });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload[key] as T;
}

async function restoreAdminState(request: APIRequestContext, path: string, data: Record<string, unknown>) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await request.put(path, { headers: adminHeaders, data });
      expect(response.ok()).toBeTruthy();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  throw lastError;
}

async function signIn(page: Page) {
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByLabel('Admin password').fill('test-admin');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Content operations dashboard' })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-dashboard-ready="true"]')).toBeVisible({ timeout: 15000 });
}

async function withPreviewPage(page: Page, callback: (previewPage: Page) => Promise<void>) {
  const previewPage = await page.context().newPage();
  try {
    await callback(previewPage);
  } finally {
    await previewPage.close();
  }
}

test.describe.serial('admin dashboard', () => {
  let originalBooks: BookRecord[];
  let originalEvents: EventContentMap;
  let originalCapacity: CapacityConfigFile;
  let originalEmailSettings: RegistrationSuccessEmailSettings;

  test.beforeEach(async ({ request }) => {
    originalBooks = await readAdminState<BookRecord[]>(request, '/api/admin/books', 'books');
    originalEvents = await readAdminState<EventContentMap>(request, '/api/admin/events', 'events');
    originalCapacity = await readAdminState<CapacityConfigFile>(request, '/api/admin/capacity', 'capacity');
    originalEmailSettings = await readAdminState<RegistrationSuccessEmailSettings>(request, '/api/admin/email', 'settings');
  });

  test.afterEach(async ({ request }) => {
    await restoreAdminState(request, '/api/admin/books', { books: originalBooks });
    await restoreAdminState(request, '/api/admin/events', { events: originalEvents });
    await restoreAdminState(request, '/api/admin/capacity', { capacity: originalCapacity });
    await restoreAdminState(request, '/api/admin/email', { settings: originalEmailSettings });
    await request.delete('/api/admin/email?outbox=1', { headers: adminHeaders });

    for (const location of ['TW', 'NL', 'EN', 'DETOX']) {
      await request.delete(`/api/submit?loc=${location}&forceFull=0`);
    }
  });

  test('can update event copy and book copy from the admin dashboard', async ({ page }) => {
    const firstBook = originalBooks[0];
    const nextEventTitle = `Admin Taiwan Session ${Date.now()}`;
    const nextBookTitle = `Admin Book Title ${Date.now()}`;

    await signIn(page);

    await page.getByRole('button', { name: 'Events', exact: true }).click();
    const eventsEditor = page.getByLabel('Events editor');
    await eventsEditor.getByLabel('Title (EN)').fill(nextEventTitle);
    const eventSaveResponse = page.waitForResponse((response) => response.url().includes('/api/admin/events') && response.request().method() === 'PUT');
    await eventsEditor.getByRole('button', { name: 'Save events' }).click();
    expect((await eventSaveResponse).ok()).toBeTruthy();
    await expect(page.getByText('Event content and posters updated. Public event pages were revalidated.')).toBeVisible();

    await withPreviewPage(page, async (previewPage) => {
      await previewPage.goto('/en/events', { waitUntil: 'domcontentloaded' });
      await expect(previewPage.getByRole('heading', { name: nextEventTitle })).toBeVisible();
    });

    await withPreviewPage(page, async (previewPage) => {
      await previewPage.goto('/en/signup?location=TW', { waitUntil: 'domcontentloaded' });
      await expect(previewPage.getByRole('link', { name: nextEventTitle })).toBeVisible();
    });

    await expect(page.getByRole('heading', { name: 'Content operations dashboard' })).toBeVisible();
    await expect(page.locator('[data-dashboard-ready="true"]')).toBeVisible();
    await page.getByRole('button', { name: 'Books', exact: true }).click();
    const booksEditor = page.getByLabel('Books editor');
    await booksEditor.getByLabel('Title (EN)').fill(nextBookTitle);
    const bookSaveResponse = page.waitForResponse((response) => response.url().includes('/api/admin/books') && response.request().method() === 'PUT');
    await booksEditor.getByRole('button', { name: 'Save books' }).click();
    expect((await bookSaveResponse).ok()).toBeTruthy();
    await expect(page.getByText('Books updated. Public pages were revalidated.')).toBeVisible();

    await withPreviewPage(page, async (previewPage) => {
      await previewPage.goto(`/en/books/${firstBook.slug}`, { waitUntil: 'domcontentloaded' });
      await expect(previewPage.getByRole('heading', { name: nextBookTitle })).toBeVisible();
    });
  });

  test('can add a draft book from the admin dashboard and publish it', async ({ page }) => {
    const nextBookSlug = `admin-added-book-${Date.now()}`;
    const nextBookTitle = `Admin Added Book ${Date.now()}`;

    await signIn(page);
    await page.getByRole('button', { name: 'Books', exact: true }).click();

    const booksEditor = page.getByLabel('Books editor');
    await booksEditor.getByRole('button', { name: 'Add book' }).click();
    await expect(page.getByText('Draft book added. Fill in the fields and save books to publish it.')).toBeVisible();

    await booksEditor.getByLabel('Title (EN)').fill(nextBookTitle);
    await booksEditor.getByLabel('Title (ZH)').fill('新增書籍');
    await booksEditor.getByLabel('Author (EN)').fill('Admin Author');
    await booksEditor.getByLabel('Author (ZH)').fill('管理員作者');
    await booksEditor.getByLabel('Read date').fill('2026-03-13');
    await booksEditor.getByLabel('Slug').fill(nextBookSlug);

    const bookSaveResponse = page.waitForResponse((response) => response.url().includes('/api/admin/books') && response.request().method() === 'PUT');
    await booksEditor.getByRole('button', { name: 'Save books' }).click();
    expect((await bookSaveResponse).ok()).toBeTruthy();
    await expect(page.getByText('Books updated. Public pages were revalidated.')).toBeVisible();

    await withPreviewPage(page, async (previewPage) => {
      await previewPage.goto(`/en/books/${nextBookSlug}`, { waitUntil: 'domcontentloaded' });
      await expect(previewPage.getByRole('heading', { name: nextBookTitle })).toBeVisible();
    });
  });

  test('keeps book editing stable after changing the slug and persists later field edits', async ({ page }) => {
    const updatedSlug = `stable-admin-book-${Date.now()}`;
    const updatedTitle = `Stable Admin Title ${Date.now()}`;

    await signIn(page);
    await page.getByRole('button', { name: 'Books', exact: true }).click();

    const booksEditor = page.getByLabel('Books editor');
    await booksEditor.getByLabel('Slug').fill(updatedSlug);
    await booksEditor.getByLabel('Title (EN)').fill(updatedTitle);

    const saveResponse = page.waitForResponse((response) => response.url().includes('/api/admin/books') && response.request().method() === 'PUT');
    await booksEditor.getByRole('button', { name: 'Save books' }).click();
    expect((await saveResponse).ok()).toBeTruthy();

    await withPreviewPage(page, async (previewPage) => {
      await previewPage.goto(`/en/books/${updatedSlug}`, { waitUntil: 'domcontentloaded' });
      await expect(previewPage.getByRole('heading', { name: updatedTitle })).toBeVisible();
    });
  });

  test('supports load more and drag-reordering books, and syncs the order to public pages', async ({ page }) => {
    test.skip(originalBooks.length < 11, 'Requires more than 10 books to verify load more behavior.');

    const originalFirst = originalBooks[0];
    const originalSecond = originalBooks[1];
    const reorderedFirstTitle = originalSecond.titleEn || originalSecond.title;

    await signIn(page);
    await page.getByRole('button', { name: 'Books', exact: true }).click();

    const booksEditor = page.getByLabel('Books editor');
    const bookButtons = booksEditor.locator('aside .space-y-2 > button');
    await expect(bookButtons).toHaveCount(10);
    await booksEditor.getByRole('button', { name: 'Load more books' }).click();
    await expect(bookButtons).toHaveCount(Math.min(20, originalBooks.length));

    await bookButtons.nth(1).dragTo(bookButtons.nth(0));
    await expect(page.getByText('Book order updated locally. Save books to publish the new order.')).toBeVisible();

    const saveResponse = page.waitForResponse((response) => response.url().includes('/api/admin/books') && response.request().method() === 'PUT');
    await booksEditor.getByRole('button', { name: 'Save books' }).click();
    expect((await saveResponse).ok()).toBeTruthy();

    await withPreviewPage(page, async (previewPage) => {
      await previewPage.goto('/en/books', { waitUntil: 'domcontentloaded' });
      await expect(previewPage.locator('ul > li').first()).toContainText(reorderedFirstTitle);
    });

    await withPreviewPage(page, async (previewPage) => {
      await previewPage.goto('/en', { waitUntil: 'domcontentloaded' });
      await expect(previewPage.locator('section[aria-labelledby="books-wall-heading"] li a').first()).toHaveAttribute('href', `/en/books/${originalSecond.slug}`);
    });

    expect(originalFirst.slug).not.toBe(originalSecond.slug);
  });

  test('can delete a draft book and remove it from the public books page after saving', async ({ page }) => {
    const deletedSlug = `deleted-admin-book-${Date.now()}`;

    await signIn(page);
    await page.getByRole('button', { name: 'Books', exact: true }).click();

    const booksEditor = page.getByLabel('Books editor');
    await booksEditor.getByRole('button', { name: 'Add book' }).click();
    await booksEditor.getByLabel('Slug').fill(deletedSlug);
    await booksEditor.getByLabel('Title (EN)').fill('Delete Me');

    const saveAddedResponse = page.waitForResponse((response) => response.url().includes('/api/admin/books') && response.request().method() === 'PUT');
    await booksEditor.getByRole('button', { name: 'Save books' }).click();
    expect((await saveAddedResponse).ok()).toBeTruthy();

    page.once('dialog', (dialog) => dialog.accept());
    await booksEditor.getByRole('button', { name: 'Delete book' }).click();
    await expect(booksEditor.getByLabel('Slug')).not.toHaveValue(deletedSlug);

    const saveDeletedResponse = page.waitForResponse((response) => response.url().includes('/api/admin/books') && response.request().method() === 'PUT');
    await booksEditor.getByRole('button', { name: 'Save books' }).click();
    expect((await saveDeletedResponse).ok()).toBeTruthy();

    await withPreviewPage(page, async (previewPage) => {
      await previewPage.goto('/en/books', { waitUntil: 'domcontentloaded' });
      await expect(previewPage.getByRole('link', { name: /Delete Me/i })).toHaveCount(0);
    });
  });

  test('can upload an optimized cover from admin and publish it directly to the public book page', async ({ page }) => {
    const uploadedBook = originalBooks[0];
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR42mNk+A8AAwMBASs7fS0AAAAASUVORK5CYII=',
      'base64'
    );

    await signIn(page);
    await page.getByRole('button', { name: 'Books', exact: true }).click();

    const booksEditor = page.getByLabel('Books editor');
    const fileInputs = booksEditor.locator('input[type="file"]');
    const uploadResponse = page.waitForResponse((response) => response.url().includes('/api/admin/upload') && response.request().method() === 'POST');
    const publishResponse = page.waitForResponse((response) => response.url().includes('/api/admin/books') && response.request().method() === 'PUT');
    await fileInputs.first().setInputFiles({
      name: 'cover.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    expect((await uploadResponse).ok()).toBeTruthy();
    expect((await publishResponse).ok()).toBeTruthy();

    await withPreviewPage(page, async (previewPage) => {
      await previewPage.goto(`/en/books/${uploadedBook.slug}`, { waitUntil: 'domcontentloaded' });
      const coverImage = previewPage.getByAltText(new RegExp(`${uploadedBook.titleEn || uploadedBook.title} - Cover 1`));
      await expect(coverImage).toBeVisible();
      await expect(coverImage).toHaveAttribute('src', /webp/);
    });
  });

  test('can tighten capacity from admin and surface the full-state on the public signup page', async ({ page, request }) => {
    const now = Date.now();
    const startAt = new Date(now - 60 * 60 * 1000);
    const endAt = new Date(now + 24 * 60 * 60 * 1000);

    await signIn(page);
    await page.getByRole('button', { name: 'Capacity', exact: true }).click();

    const capacityEditor = page.getByLabel('Capacity editor');
    const twCard = capacityEditor.getByLabel('Capacity TW');
    await twCard.getByLabel('Start at').fill(toInputDate(startAt));
    await twCard.getByLabel('End at').fill(toInputDate(endAt));
    await twCard.getByLabel('Capacity').fill('1');
    const enabledToggle = twCard.getByLabel('Enabled');
    if (!(await enabledToggle.isChecked())) {
      await enabledToggle.check();
    }
    const forceFullToggle = twCard.getByLabel('Force full immediately');
    if (await forceFullToggle.isChecked()) {
      await forceFullToggle.uncheck();
    }

    const capacitySaveResponse = page.waitForResponse((response) => response.url().includes('/api/admin/capacity') && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save capacity settings' }).click();
    expect((await capacitySaveResponse).ok()).toBeTruthy();
    await expect(page.getByText('Signup windows and capacity settings updated.')).toBeVisible();

    const resetResponse = await request.delete('/api/submit?loc=TW&tempMax=1&forceFull=0');
    expect(resetResponse.ok()).toBeTruthy();

    const submitResponse = await request.post('/api/submit?loc=TW', {
      data: {
        name: 'Admin Capacity Test',
        age: 30,
        profession: 'QA',
        email: `admin-capacity-${Date.now()}@example.com`,
        referral: 'Instagram',
        bankAccount: '12345',
      },
    });
    expect(submitResponse.status()).toBe(201);

    await page.goto('/en/signup?location=TW', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Registration Full')).toBeVisible({ timeout: 15000 });
  });

  test('shows live signup counts and remaining slots in the capacity editor', async ({ page, request }) => {
    const now = Date.now();
    const startAt = new Date(now - 60 * 60 * 1000);
    const endAt = new Date(now + 24 * 60 * 60 * 1000);

    const nextCapacity = {
      ...originalCapacity,
      TW: {
        ...originalCapacity.TW,
        enabled: true,
        forceFull: false,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        max: 3,
      },
    };

    const capacityResponse = await request.put('/api/admin/capacity', { headers: adminHeaders, data: { capacity: nextCapacity } });
    expect(capacityResponse.ok()).toBeTruthy();

    const resetResponse = await request.delete('/api/submit?loc=TW&tempMax=3&forceFull=0');
    expect(resetResponse.ok()).toBeTruthy();

    const submitResponse = await request.post('/api/submit?loc=TW', {
      data: {
        name: 'Capacity Counter Test',
        age: 29,
        profession: 'QA',
        email: `capacity-counter-${now}@example.com`,
        referral: 'Instagram',
      },
    });
    expect(submitResponse.status()).toBe(201);

    await signIn(page);
    await page.getByRole('button', { name: 'Capacity', exact: true }).click();

    const twCard = page.getByLabel('Capacity TW');
    await expect(twCard.getByText('Successful signups')).toBeVisible();
    await expect(twCard.getByText('1')).toBeVisible();
    await expect(twCard.getByText('Remaining if saved now')).toBeVisible();
    await expect(twCard.getByText('2')).toBeVisible();
  });

  test('can configure registration success emails from admin and send a localized confirmation email', async ({ page, request }) => {
    const now = Date.now();
    const startAt = new Date(now - 60 * 60 * 1000);
    const endAt = new Date(now + 24 * 60 * 60 * 1000);
    const subject = `管理後台寄信測試 ${now}`;
    const body = `嗨 {{name}}，這是 {{eventTitle}} 的測試郵件。\n站點：{{siteUrl}}`;

    await request.delete('/api/admin/email?outbox=1', { headers: adminHeaders });

    const nextCapacity = {
      ...originalCapacity,
      TW: {
        ...originalCapacity.TW,
        enabled: true,
        forceFull: false,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        max: 5,
      },
    };
    const capacityResponse = await request.put('/api/admin/capacity', { headers: adminHeaders, data: { capacity: nextCapacity } });
    expect(capacityResponse.ok()).toBeTruthy();
    const resetResponse = await request.delete('/api/submit?loc=TW&tempMax=5&forceFull=0');
    expect(resetResponse.ok()).toBeTruthy();

    await signIn(page);
    await page.getByRole('button', { name: 'Emails', exact: true }).click();

    const emailEditor = page.getByLabel('Registration email editor');
    const enabledToggle = emailEditor.getByLabel('Send registration success emails automatically');
    if (!(await enabledToggle.isChecked())) {
      await enabledToggle.check();
    }

    const zhPanel = emailEditor.getByRole('heading', { name: 'Template (ZH)' }).locator('..');
    await zhPanel.getByLabel('Subject').fill(subject);
    await zhPanel.getByLabel('Body').fill(body);

    const saveResponse = page.waitForResponse((response) => response.url().includes('/api/admin/email') && response.request().method() === 'PUT');
    await emailEditor.getByRole('button', { name: 'Save email settings' }).click();
    expect((await saveResponse).ok()).toBeTruthy();
    await expect(page.getByText('Registration success email settings updated.')).toBeVisible();

    const submitResponse = await request.post('/api/submit?loc=TW', {
      data: {
        locale: 'zh',
        name: '管理員測試用戶',
        age: 30,
        profession: 'QA',
        email: `admin-email-${now}@example.com`,
        referral: 'Instagram',
      },
    });
    expect(submitResponse.status()).toBe(201);
    const submitPayload = await submitResponse.json();
    expect(submitPayload.email).toMatchObject({ status: 'sent', transport: 'file' });

    const outbox = await readAdminState<EmailOutboxRecord[]>(request, '/api/admin/email?includeOutbox=1', 'outbox');
    expect(outbox[0]).toMatchObject({
      to: `admin-email-${now}@example.com`,
      locale: 'zh',
      location: 'TW',
      transport: 'file',
    });
    expect(outbox[0].subject).toContain(subject);
    expect(outbox[0].text).toContain('管理員測試用戶');
    expect(outbox[0].text).toContain('台灣讀書會');
  });

  test('shows the admin-specific favicon and the registrations audit viewer', async ({ page, request }) => {
    const now = Date.now();
    const resetResponse = await request.delete('/api/submit?loc=EN&tempMax=3&forceFull=0');
    expect(resetResponse.ok()).toBeTruthy();

    const submitResponse = await request.post('/api/submit?loc=EN', {
      data: {
        locale: 'en',
        name: 'Viewer Reader',
        age: 31,
        profession: 'Analyst',
        email: `viewer-${now}@example.com`,
        referral: 'Instagram',
      },
    });
    expect(submitResponse.status()).toBe(201);

    await signIn(page);
    const faviconHref = await page.locator('link[rel="icon"]').first().getAttribute('href');
    expect(faviconHref).toContain('/images/favicon-en.ico');

    await page.getByRole('button', { name: 'Registrations', exact: true }).click();
    const viewer = page.getByLabel('Registrations viewer');
    await expect(viewer.getByRole('heading', { name: 'Registrations audit' })).toBeVisible();
    await expect(viewer.getByText('Viewer Reader')).toBeVisible({ timeout: 15000 });
    await expect(viewer.getByText('registration-store')).toBeVisible();
  });
});