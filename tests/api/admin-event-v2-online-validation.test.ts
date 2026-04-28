import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/event-v2/route';

vi.mock('@/lib/admin-auth', () => ({
  isAuthorizedAdminRequest: vi.fn(),
}));

vi.mock('@/lib/events', () => ({
  createEvent: vi.fn(),
}));

vi.mock('@/lib/event-types', () => ({
  getEventTypeByCode: vi.fn(),
}));

vi.mock('@/lib/observability', () => ({
  runWithRequestTrace: vi.fn((req, name, fn) => fn()),
  logServerError: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { isAuthorizedAdminRequest } = await import('@/lib/admin-auth');
const { createEvent } = await import('@/lib/events');
const { getEventTypeByCode } = await import('@/lib/event-types');

describe('POST /api/admin/event-v2 - online venue validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow creating ENGLISH_BOOK_CLUB event with ONLINE venue', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventTypeByCode).mockResolvedValue({
      code: 'ENGLISH_BOOK_CLUB',
      nameEn: 'English Book Club',
      nameZh: '英文讀書會',
      onlinePossible: true,
    });
    vi.mocked(createEvent).mockResolvedValue({
      id: 1,
      slug: 'test-online-event',
      eventTypeCode: 'ENGLISH_BOOK_CLUB',
      title: 'Test Online Event',
      titleEn: null,
      venueLocation: 'ONLINE',
      venueCapacity: 20,
      venueName: null,
      venueNameEn: null,
      venueAddress: null,
      paymentAmount: 0,
      paymentCurrency: 'USD',
      signupIntroTemplate: 'default',
      eventDate: '2026-06-01T19:00:00Z',
      registrationOpenDate: '2026-05-01T00:00:00Z',
      registrationCloseDate: '2026-05-30T23:59:59Z',
      description: null,
      descriptionEn: null,
      coverUrl: null,
      coverUrlEn: null,
      bookId: null,
      bookTitle: null,
      bookTitleEn: null,
      createdAt: '2026-04-28T00:00:00Z',
      updatedAt: '2026-04-28T00:00:00Z',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/event-v2', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'test-online-event',
        eventTypeCode: 'ENGLISH_BOOK_CLUB',
        venueLocation: 'ONLINE',
        venueCapacity: 20,
        title: 'Test Online Event',
        eventDate: '2026-06-01T19:00:00Z',
        registrationOpensAt: '2026-05-01T00:00:00Z',
        registrationClosesAt: '2026-05-30T23:59:59Z',
        paymentAmount: 0,
        paymentCurrency: 'USD',
        introTemplateName: 'default',
        isPublished: true,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(getEventTypeByCode).toHaveBeenCalledWith('ENGLISH_BOOK_CLUB');
    expect(createEvent).toHaveBeenCalled();
  });

  it('should reject MANDARIN_BOOK_CLUB event with ONLINE venue', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventTypeByCode).mockResolvedValue({
      code: 'MANDARIN_BOOK_CLUB',
      nameEn: 'Mandarin Book Club',
      nameZh: '中文讀書會',
      onlinePossible: false,
    });

    const request = new NextRequest('http://localhost:3000/api/admin/event-v2', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'test-mandarin-online',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueLocation: 'ONLINE',
        venueCapacity: 20,
        title: 'Test Mandarin Online',
        eventDate: '2026-06-01T19:00:00Z',
        registrationOpensAt: '2026-05-01T00:00:00Z',
        registrationClosesAt: '2026-05-30T23:59:59Z',
        paymentAmount: 100,
        paymentCurrency: 'TWD',
        introTemplateName: 'default',
        isPublished: true,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Event type MANDARIN_BOOK_CLUB does not support online venues');
    expect(getEventTypeByCode).toHaveBeenCalledWith('MANDARIN_BOOK_CLUB');
    expect(createEvent).not.toHaveBeenCalled();
  });

  it('should reject DETOX event with ONLINE venue', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventTypeByCode).mockResolvedValue({
      code: 'DETOX',
      nameEn: 'Detox',
      nameZh: '數位排毒',
      onlinePossible: false,
    });

    const request = new NextRequest('http://localhost:3000/api/admin/event-v2', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'test-detox-online',
        eventTypeCode: 'DETOX',
        venueLocation: 'ONLINE',
        venueCapacity: 20,
        title: 'Test Detox Online',
        eventDate: '2026-06-01T19:00:00Z',
        registrationOpensAt: '2026-05-01T00:00:00Z',
        registrationClosesAt: '2026-05-30T23:59:59Z',
        paymentAmount: 0,
        paymentCurrency: 'TWD',
        introTemplateName: 'default',
        isPublished: true,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Event type DETOX does not support online venues');
  });

  it('should allow DETOX event with physical venue (TW)', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(createEvent).mockResolvedValue({
      id: 2,
      slug: 'test-detox-tw',
      eventTypeCode: 'DETOX',
      venueLocation: 'TW',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/event-v2', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'test-detox-tw',
        eventTypeCode: 'DETOX',
        venueLocation: 'TW',
        venueCapacity: 30,
        title: 'Test Detox Taiwan',
        eventDate: '2026-06-01T19:00:00Z',
        registrationOpensAt: '2026-05-01T00:00:00Z',
        registrationClosesAt: '2026-05-30T23:59:59Z',
        paymentAmount: 200,
        paymentCurrency: 'TWD',
        introTemplateName: 'default',
        isPublished: true,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(getEventTypeByCode).not.toHaveBeenCalled();
    expect(createEvent).toHaveBeenCalled();
  });

  it('should reject FAMILY_READING_CLUB event with ONLINE venue', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventTypeByCode).mockResolvedValue({
      code: 'FAMILY_READING_CLUB',
      nameEn: 'Family Reading Club',
      nameZh: '親子讀書會',
      onlinePossible: false,
    });

    const request = new NextRequest('http://localhost:3000/api/admin/event-v2', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'test-family-online',
        eventTypeCode: 'FAMILY_READING_CLUB',
        venueLocation: 'ONLINE',
        venueCapacity: 15,
        title: 'Test Family Online',
        eventDate: '2026-06-01T19:00:00Z',
        registrationOpensAt: '2026-05-01T00:00:00Z',
        registrationClosesAt: '2026-05-30T23:59:59Z',
        paymentAmount: 150,
        paymentCurrency: 'TWD',
        introTemplateName: 'default',
        isPublished: true,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Event type FAMILY_READING_CLUB does not support online venues');
  });
});
