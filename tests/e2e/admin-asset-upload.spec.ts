import { expect, test } from '@playwright/test';

test.describe('Admin asset upload API', () => {
  const adminHeaders = {
    'Authorization': 'Bearer test-admin',
  };

  let testEventId: number;
  let testBookId: number;

  // Cleanup helper
  async function cleanup(request: any) {
    if (testEventId) {
      await request.delete(`/api/admin/registrations-by-event/${testEventId}`, {
        headers: adminHeaders,
      }).catch(() => {});

      await request.delete(`/api/admin/event-v2/${testEventId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }

    if (testBookId) {
      await request.delete(`/api/admin/book-v2/${testBookId}`, {
        headers: adminHeaders,
      }).catch(() => {});
    }
  }

  test.afterEach(async ({ request }) => {
    await cleanup(request);
  });

  test('should upload event cover via API and display on public page', async ({ page, request }) => {
    const timestamp = Date.now();
    const eventSlug = `test-upload-event-${timestamp}`;

    // Step 1: Get event types
    const eventTypesResponse = await request.get('/api/admin/event-types', {
      headers: adminHeaders,
    });
    expect(eventTypesResponse.ok()).toBeTruthy();
    const { eventTypes } = await eventTypesResponse.json();
    const eventTypeCode = eventTypes[0].code;

    // Step 2: Upload cover image
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
      'base64'
    );

    const formData = new FormData();
    formData.append('file', new Blob([testImageBuffer], { type: 'image/png' }), 'test-cover.png');

    const uploadResponse = await request.post('/api/admin/upload?scope=events', {
      headers: adminHeaders,
      multipart: {
        file: {
          name: 'test-cover.png',
          mimeType: 'image/png',
          buffer: testImageBuffer,
        },
      },
    });

    expect(uploadResponse.ok()).toBeTruthy();
    const uploadData = await uploadResponse.json();
    expect(uploadData.src).toMatch(/^https?:\/\//);
    expect(uploadData.format).toBe('webp');

    const coverUrl = uploadData.src;

    // Step 3: Create event with uploaded cover
    const now = new Date();
    const futureEvent = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const futureRegOpens = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const futureRegCloses = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

    const createResponse = await request.post('/api/admin/event-v2', {
      headers: adminHeaders,
      data: {
        slug: eventSlug,
        eventTypeCode,
        title: 'Upload Test Event',
        coverUrl,
        eventDate: futureEvent.toISOString(),
        registrationOpensAt: futureRegOpens.toISOString(),
        registrationClosesAt: futureRegCloses.toISOString(),
        venueLocation: 'TW',
        venueCapacity: 20,
        venueName: 'Test Venue',
        isPublished: true,
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const { event } = await createResponse.json();
    testEventId = event.id;

    // Step 4: Verify image is accessible
    const imageResponse = await request.get(coverUrl);
    expect(imageResponse.ok()).toBeTruthy();
    expect(imageResponse.headers()['content-type']).toMatch(/^image\//);

    // Step 5: Verify event appears on public page with image
    await page.goto('/en/events/TW');
    const eventImage = page.locator(`img[alt*="Upload Test Event"]`);
    await expect(eventImage).toBeVisible({ timeout: 10000 });
  });

  test('should upload book cover via API and display on public page', async ({ page, request }) => {
    const timestamp = Date.now();
    const bookSlug = `test-upload-book-${timestamp}`;

    // Step 1: Upload cover image
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==',
      'base64'
    );

    const uploadResponse = await request.post('/api/admin/upload?scope=books', {
      headers: adminHeaders,
      multipart: {
        file: {
          name: 'test-book-cover.png',
          mimeType: 'image/png',
          buffer: testImageBuffer,
        },
      },
    });

    expect(uploadResponse.ok()).toBeTruthy();
    const uploadData = await uploadResponse.json();
    expect(uploadData.src).toMatch(/^https?:\/\//);
    const coverUrl = uploadData.src;

    // Step 2: Create book with uploaded cover
    const createResponse = await request.post('/api/admin/book-v2', {
      headers: adminHeaders,
      data: {
        slug: bookSlug,
        title: 'Upload Test Book',
        author: 'Test Author',
        coverUrl,
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const { book } = await createResponse.json();
    testBookId = book.id;

    // Step 3: Verify image is accessible
    const imageResponse = await request.get(coverUrl);
    expect(imageResponse.ok()).toBeTruthy();
    expect(imageResponse.headers()['content-type']).toMatch(/^image\//);

    // Step 4: Verify book appears on public page with image
    await page.goto('/en/books');
    const bookImage = page.locator(`img[alt*="Upload Test Book"]`);
    await expect(bookImage).toBeVisible({ timeout: 10000 });
  });

  test('should handle upload errors gracefully', async ({ request }) => {
    // Test: File too large (6MB > 5MB limit)
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
    const largeUploadResponse = await request.post('/api/admin/upload?scope=events', {
      headers: adminHeaders,
      multipart: {
        file: {
          name: 'too-large.png',
          mimeType: 'image/png',
          buffer: largeBuffer,
        },
      },
    });

    expect(largeUploadResponse.status()).toBe(400);
    const largeError = await largeUploadResponse.json();
    expect(largeError.error).toMatch(/too large/i);

    // Test: Invalid file type
    const txtBuffer = Buffer.from('not an image');
    const invalidTypeResponse = await request.post('/api/admin/upload?scope=events', {
      headers: adminHeaders,
      multipart: {
        file: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: txtBuffer,
        },
      },
    });

    expect(invalidTypeResponse.status()).toBe(400);
    const typeError = await invalidTypeResponse.json();
    expect(typeError.error).toMatch(/Unsupported file type/i);

    // Test: Invalid scope
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
      'base64'
    );

    const invalidScopeResponse = await request.post('/api/admin/upload?scope=invalid', {
      headers: adminHeaders,
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: testImageBuffer,
        },
      },
    });

    expect(invalidScopeResponse.status()).toBe(400);
    const scopeError = await invalidScopeResponse.json();
    expect(scopeError.error).toMatch(/Invalid upload scope/i);
  });

  test('should support bilingual event covers', async ({ page, request }) => {
    const timestamp = Date.now();
    const eventSlug = `test-bilingual-event-${timestamp}`;

    // Get event types
    const eventTypesResponse = await request.get('/api/admin/event-types', {
      headers: adminHeaders,
    });
    const { eventTypes } = await eventTypesResponse.json();

    // Upload Chinese cover (red pixel)
    const redPixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
      'base64'
    );

    const zhUploadResponse = await request.post('/api/admin/upload?scope=events', {
      headers: adminHeaders,
      multipart: {
        file: {
          name: 'cover-zh.png',
          mimeType: 'image/png',
          buffer: redPixel,
        },
      },
    });
    expect(zhUploadResponse.ok()).toBeTruthy();
    const zhData = await zhUploadResponse.json();
    const zhCoverUrl = zhData.src;

    // Upload English cover (blue pixel)
    const bluePixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==',
      'base64'
    );

    const enUploadResponse = await request.post('/api/admin/upload?scope=events', {
      headers: adminHeaders,
      multipart: {
        file: {
          name: 'cover-en.png',
          mimeType: 'image/png',
          buffer: bluePixel,
        },
      },
    });
    expect(enUploadResponse.ok()).toBeTruthy();
    const enData = await enUploadResponse.json();
    const enCoverUrl = enData.src;

    expect(zhCoverUrl).not.toBe(enCoverUrl); // Different URLs

    // Create bilingual event
    const now = new Date();
    const futureEvent = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const futureRegOpens = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const futureRegCloses = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

    const createResponse = await request.post('/api/admin/event-v2', {
      headers: adminHeaders,
      data: {
        slug: eventSlug,
        eventTypeCode: eventTypes[0].code,
        title: '雙語測試活動',
        titleEn: 'Bilingual Test Event',
        coverUrl: zhCoverUrl,
        coverUrlEn: enCoverUrl,
        eventDate: futureEvent.toISOString(),
        registrationOpensAt: futureRegOpens.toISOString(),
        registrationClosesAt: futureRegCloses.toISOString(),
        venueLocation: 'TW',
        venueCapacity: 20,
        venueName: 'Test Venue',
        isPublished: true,
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const { event } = await createResponse.json();
    testEventId = event.id;

    // Verify both images load
    const zhImageResponse = await request.get(zhCoverUrl);
    expect(zhImageResponse.ok()).toBeTruthy();

    const enImageResponse = await request.get(enCoverUrl);
    expect(enImageResponse.ok()).toBeTruthy();

    // Verify Chinese page shows Chinese cover
    await page.goto('/zh/events/TW');
    const zhImage = page.locator(`img[alt*="雙語測試活動"]`);
    await expect(zhImage).toBeVisible({ timeout: 10000 });

    // Verify English page shows English cover
    await page.goto('/en/events/TW');
    const enImage = page.locator(`img[alt*="Bilingual Test Event"]`);
    await expect(enImage).toBeVisible({ timeout: 10000 });
  });

  test('should require authentication for upload', async ({ request }) => {
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
      'base64'
    );

    // Upload without auth header
    const unauthResponse = await request.post('/api/admin/upload?scope=events', {
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: testImageBuffer,
        },
      },
    });

    expect(unauthResponse.status()).toBe(401);
    const error = await unauthResponse.json();
    expect(error.error).toBe('Unauthorized');
  });
});
