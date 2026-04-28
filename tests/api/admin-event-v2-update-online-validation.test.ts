import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT } from '@/app/api/admin/event-v2/[id]/route';

vi.mock('@/lib/admin-auth', () => ({
  isAuthorizedAdminRequest: vi.fn(),
}));

vi.mock('@/lib/events', () => ({
  getEventById: vi.fn(),
  updateEvent: vi.fn(),
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
const { updateEvent } = await import('@/lib/events');
const { getEventTypeByCode } = await import('@/lib/event-types');

describe('PUT /api/admin/event-v2/[id] - online venue validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow updating event to ONLINE venue with ENGLISH_BOOK_CLUB', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventTypeByCode).mockResolvedValue({
      code: 'ENGLISH_BOOK_CLUB',
      nameEn: 'English Book Club',
      nameZh: '英文讀書會',
      onlinePossible: true,
    });
    vi.mocked(updateEvent).mockResolvedValue({
      id: 1,
      eventTypeCode: 'ENGLISH_BOOK_CLUB',
      venueLocation: 'ONLINE',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/event-v2/1', {
      method: 'PUT',
      body: JSON.stringify({
        venueLocation: 'ONLINE',
        eventTypeCode: 'ENGLISH_BOOK_CLUB',
      }),
    });

    const response = await PUT(request, { params: { id: '1' } });

    expect(response.status).toBe(200);
    expect(getEventTypeByCode).toHaveBeenCalledWith('ENGLISH_BOOK_CLUB');
    expect(updateEvent).toHaveBeenCalled();
  });

  it('should reject updating event to ONLINE venue with MANDARIN_BOOK_CLUB', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventTypeByCode).mockResolvedValue({
      code: 'MANDARIN_BOOK_CLUB',
      nameEn: 'Mandarin Book Club',
      nameZh: '中文讀書會',
      onlinePossible: false,
    });

    const request = new NextRequest('http://localhost:3000/api/admin/event-v2/2', {
      method: 'PUT',
      body: JSON.stringify({
        venueLocation: 'ONLINE',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
      }),
    });

    const response = await PUT(request, { params: { id: '2' } });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Event type MANDARIN_BOOK_CLUB does not support online venues');
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it('should reject updating event to ONLINE venue with DETOX', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventTypeByCode).mockResolvedValue({
      code: 'DETOX',
      nameEn: 'Detox',
      nameZh: '數位排毒',
      onlinePossible: false,
    });

    const request = new NextRequest('http://localhost:3000/api/admin/event-v2/3', {
      method: 'PUT',
      body: JSON.stringify({
        venueLocation: 'ONLINE',
        eventTypeCode: 'DETOX',
      }),
    });

    const response = await PUT(request, { params: { id: '3' } });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Event type DETOX does not support online venues');
  });

  it('should allow updating event to physical venue regardless of event type', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(updateEvent).mockResolvedValue({
      id: 4,
      eventTypeCode: 'DETOX',
      venueLocation: 'TW',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/event-v2/4', {
      method: 'PUT',
      body: JSON.stringify({
        venueLocation: 'TW',
        eventTypeCode: 'DETOX',
      }),
    });

    const response = await PUT(request, { params: { id: '4' } });

    expect(response.status).toBe(200);
    expect(getEventTypeByCode).not.toHaveBeenCalled();
    expect(updateEvent).toHaveBeenCalled();
  });

  it('should allow updating other fields without venue location change', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(updateEvent).mockResolvedValue({
      id: 5,
      title: 'Updated Title',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/event-v2/5', {
      method: 'PUT',
      body: JSON.stringify({
        title: 'Updated Title',
        description: 'Updated description',
      }),
    });

    const response = await PUT(request, { params: { id: '5' } });

    expect(response.status).toBe(200);
    expect(getEventTypeByCode).not.toHaveBeenCalled();
    expect(updateEvent).toHaveBeenCalled();
  });
});
