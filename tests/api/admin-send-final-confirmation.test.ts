import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { POST } from '@/app/api/admin/send-final-confirmation/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/admin-auth', () => ({
  isAuthorizedAdminRequest: vi.fn(),
}));

vi.mock('@/lib/supabase-utils', () => ({
  fetchRows: vi.fn(),
  getTableUrl: vi.fn(() => 'https://test.supabase.co/rest/v1/registrations'),
  getSupabaseHeaders: vi.fn(() => ({ apikey: 'test-key', Authorization: 'Bearer test-key' })),
}));

vi.mock('@/lib/email-service', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/observability', () => ({
  runWithRequestTrace: vi.fn((req, name, fn) => fn()),
}));

vi.mock('@/lib/date-formatter', () => ({
  formatEventDate: vi.fn((date, locale) =>
    locale === 'zh' ? '2026年5月1日 下午2:00' : 'May 1, 2026 at 2:00 PM'
  ),
}));

vi.mock('@/lib/env', () => ({
  CLIENT_ENV: {
    SITE_URL: 'https://bookdigest.test',
  },
  EMAIL_CONFIG: {
    REGISTRATION_EMAIL_REPLY_TO: 'test@bookdigest.test',
  },
}));

import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { fetchRows, getTableUrl, getSupabaseHeaders } from '@/lib/supabase-utils';
import { sendEmail } from '@/lib/email-service';

describe('POST /api/admin/send-final-confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createRequest = (body: unknown) => {
    return new NextRequest('http://localhost:3000/api/admin/send-final-confirmation', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const mockRegistrations = [
    {
      id: 'reg-1',
      name: 'Test User 1',
      email: 'user1@test.com',
      locale: 'zh',
      status: 'confirmed',
      event_id: 1,
      audit_trail: [],
      events: {
        id: 1,
        title: 'Test Event',
        title_en: 'Test Event EN',
        event_date: '2026-05-01T14:00:00Z',
        venue_location: 'TW',
        venue_name: 'Test Venue',
        venue_address: '123 Test St',
      },
    },
    {
      id: 'reg-2',
      name: 'Test User 2',
      email: 'user2@test.com',
      locale: 'en',
      status: 'confirmed',
      event_id: 1,
      audit_trail: [],
      events: {
        id: 1,
        title: 'Test Event',
        title_en: 'Test Event EN',
        event_date: '2026-05-01T14:00:00Z',
        venue_location: 'TW',
        venue_name: 'Test Venue',
        venue_address: '123 Test St',
      },
    },
  ];

  it('returns 401 when not authorized', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(false);

    const req = createRequest({
      registrationIds: ['reg-1'],
      subjectZh: 'Test',
      subjectEn: 'Test',
      templateZh: 'Test',
      templateEn: 'Test',
    });

    const response = await POST(req);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('validates registrationIds is non-empty array', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = createRequest({
      registrationIds: [],
      subjectZh: 'Test',
      subjectEn: 'Test',
      templateZh: 'Test',
      templateEn: 'Test',
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('registrationIds must be a non-empty array');
  });

  it('validates templates are not empty', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = createRequest({
      registrationIds: ['reg-1'],
      subjectZh: '',
      subjectEn: 'Test',
      templateZh: 'Test',
      templateEn: 'Test',
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Email templates cannot be empty');
  });

  it('validates all registrations are confirmed status', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(fetchRows).mockResolvedValue([
      { ...mockRegistrations[0], status: 'pending' },
    ]);

    const req = createRequest({
      registrationIds: ['reg-1'],
      subjectZh: 'Test',
      subjectEn: 'Test',
      templateZh: 'Test',
      templateEn: 'Test',
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('All registrations must be confirmed status');
  });

  it('validates all registrations belong to same event', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(fetchRows).mockResolvedValue([
      { ...mockRegistrations[0], event_id: 1 },
      { ...mockRegistrations[1], event_id: 2 },
    ]);

    const req = createRequest({
      registrationIds: ['reg-1', 'reg-2'],
      subjectZh: 'Test',
      subjectEn: 'Test',
      templateZh: 'Test',
      templateEn: 'Test',
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('All registrations must belong to the same event');
  });

  it('sends emails with correct locale-specific templates', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(fetchRows).mockResolvedValue(mockRegistrations);
    vi.mocked(sendEmail).mockResolvedValue({ status: 'sent' });

    // Mock successful status update
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ([]),
    } as Response);

    const req = createRequest({
      registrationIds: ['reg-1', 'reg-2'],
      subjectZh: 'ZH Subject {{name}}',
      subjectEn: 'EN Subject {{name}}',
      templateZh: 'ZH Body {{eventTitle}}',
      templateEn: 'EN Body {{eventTitle}}',
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    // Verify ZH email sent to user1
    expect(sendEmail).toHaveBeenCalledWith(
      'user1@test.com',
      'ZH Subject Test User 1',
      expect.stringContaining('ZH Body Test Event'),
      'test@bookdigest.test'
    );

    // Verify EN email sent to user2
    expect(sendEmail).toHaveBeenCalledWith(
      'user2@test.com',
      'EN Subject Test User 2',
      expect.stringContaining('EN Body Test Event EN'),
      'test@bookdigest.test'
    );
  });

  it('updates status to ready and adds audit trail on success', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(fetchRows).mockResolvedValue([mockRegistrations[0]]);
    vi.mocked(sendEmail).mockResolvedValue({ status: 'sent' });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([]),
    } as Response);
    global.fetch = mockFetch;

    const req = createRequest({
      registrationIds: ['reg-1'],
      subjectZh: 'Test Subject',
      subjectEn: 'Test Subject',
      templateZh: 'Test Body',
      templateEn: 'Test Body',
    });

    await POST(req);

    // Verify status update call
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('?id=eq.reg-1'),
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"status":"ready"'),
      })
    );

    const updateCall = mockFetch.mock.calls[0][1];
    const updateBody = JSON.parse(updateCall.body);

    expect(updateBody.status).toBe('ready');
    expect(updateBody.audit_trail).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'email_sent',
          actor: 'admin',
          summary: 'Final confirmation email sent',
        }),
      ])
    );
  });

  it('handles partial failures correctly', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(fetchRows).mockResolvedValue(mockRegistrations);

    // First email succeeds, second fails
    vi.mocked(sendEmail)
      .mockResolvedValueOnce({ status: 'sent' })
      .mockResolvedValueOnce({ status: 'failed', reason: 'Invalid email' });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ([]),
    } as Response);

    const req = createRequest({
      registrationIds: ['reg-1', 'reg-2'],
      subjectZh: 'Test',
      subjectEn: 'Test',
      templateZh: 'Test',
      templateEn: 'Test',
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.summary).toEqual({
      total: 2,
      successful: 1,
      failed: 1,
    });

    expect(data.results[0]).toMatchObject({
      registrationId: 'reg-1',
      success: true,
      email: 'user1@test.com',
    });

    expect(data.results[1]).toMatchObject({
      registrationId: 'reg-2',
      success: false,
      email: 'user2@test.com',
      error: 'Invalid email',
    });
  });

  it('reports error when email succeeds but status update fails', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(fetchRows).mockResolvedValue([mockRegistrations[0]]);
    vi.mocked(sendEmail).mockResolvedValue({ status: 'sent' });

    // Status update fails
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const req = createRequest({
      registrationIds: ['reg-1'],
      subjectZh: 'Test',
      subjectEn: 'Test',
      templateZh: 'Test',
      templateEn: 'Test',
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.results[0]).toMatchObject({
      success: false,
      error: 'Email sent but failed to update status',
    });
  });

  it('interpolates template variables correctly', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(fetchRows).mockResolvedValue([mockRegistrations[0]]);
    vi.mocked(sendEmail).mockResolvedValue({ status: 'sent' });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ([]),
    } as Response);

    const req = createRequest({
      registrationIds: ['reg-1'],
      subjectZh: '活動確認｜{{eventTitle}}',
      subjectEn: 'Confirmation',
      templateZh: '嗨 {{name}}，活動：{{eventTitle}}，日期：{{eventDate}}，地點：{{eventLocation}}，網站：{{siteUrl}}',
      templateEn: 'Test',
    });

    await POST(req);

    expect(sendEmail).toHaveBeenCalledWith(
      'user1@test.com',
      '活動確認｜Test Event',
      expect.stringContaining('嗨 Test User 1'),
      'test@bookdigest.test'
    );

    const emailBody = vi.mocked(sendEmail).mock.calls[0][2];
    expect(emailBody).toContain('活動：Test Event');
    expect(emailBody).toContain('日期：2026年5月1日 下午2:00');
    expect(emailBody).toContain('地點：Test Venue, 123 Test St');
    expect(emailBody).toContain('網站：https://bookdigest.test');
  });
});
