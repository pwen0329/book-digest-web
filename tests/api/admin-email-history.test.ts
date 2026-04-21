// Related to FEATURE-001
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/email-history/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/observability', () => ({
  runWithRequestTrace: vi.fn((req, name, fn) => fn()),
}));

vi.mock('@/lib/email-audit', () => ({
  getEmailHistory: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  isAuthorizedAdminRequest: vi.fn(),
}));

import { getEmailHistory } from '@/lib/email-audit';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';

describe('GET /api/admin/email-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authorized', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/admin/email-history', {
      method: 'GET',
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return email history with default pagination', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEmailHistory).mockResolvedValue({
      emails: [
        {
          id: '1',
          sentAt: '2026-04-19T10:00:00Z',
          recipientEmail: 'test@example.com',
          emailType: 'payment_confirmation',
          status: 'sent',
          eventId: 1,
          eventTitle: 'Test Event',
          registrationId: 'reg-1',
          locale: 'en',
          subject: 'Payment Confirmed',
          errorMessage: null,
        },
      ],
      total: 1,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/email-history', {
      method: 'GET',
    });

    const response = await GET(req);
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.emails).toHaveLength(1);
    expect(data.emails[0].emailType).toBe('payment_confirmation');
    expect(data.total).toBe(1);
    expect(data.limit).toBe(50);
    expect(data.offset).toBe(0);

    expect(getEmailHistory).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
    });
  });

  it('should apply custom pagination parameters', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEmailHistory).mockResolvedValue({
      emails: [],
      total: 100,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/email-history?limit=10&offset=20', {
      method: 'GET',
    });

    const response = await GET(req);
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.limit).toBe(10);
    expect(data.offset).toBe(20);

    expect(getEmailHistory).toHaveBeenCalledWith({
      limit: 10,
      offset: 20,
    });
  });

  it('should enforce maximum limit of 200', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEmailHistory).mockResolvedValue({
      emails: [],
      total: 0,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/email-history?limit=500', {
      method: 'GET',
    });

    const response = await GET(req);
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.limit).toBe(200);

    expect(getEmailHistory).toHaveBeenCalledWith({
      limit: 200,
      offset: 0,
    });
  });

  it('should filter by email type', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEmailHistory).mockResolvedValue({
      emails: [],
      total: 0,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/email-history?type=test', {
      method: 'GET',
    });

    const response = await GET(req);
    expect(response.status).toBe(200);

    expect(getEmailHistory).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
      type: 'test',
    });
  });

  it('should return 400 for invalid email type', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/email-history?type=invalid', {
      method: 'GET',
    });

    const response = await GET(req);
    expect(response.status).toBe(400);
    const data = await response.json();

    expect(data.error).toContain('Invalid type parameter');
  });

  it('should return 500 if getEmailHistory fails', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEmailHistory).mockRejectedValue(new Error('Database error'));

    const req = new NextRequest('http://localhost:3000/api/admin/email-history', {
      method: 'GET',
    });

    const response = await GET(req);
    expect(response.status).toBe(500);
    const data = await response.json();

    expect(data.ok).toBe(false);
    expect(data.error).toBe('Database error');
  });
});
