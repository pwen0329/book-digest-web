import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/registrations/[id]/confirm-payment/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/admin-auth', () => ({
  isAuthorizedAdminRequest: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/lib/supabase-utils', () => ({
  fetchRows: vi.fn(),
  getTableUrl: vi.fn((table: string) => `http://localhost:54321/rest/v1/${table}`),
  getSupabaseHeaders: vi.fn(() => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-key',
  })),
}));

vi.mock('@/lib/email-service', () => ({
  sendPaymentConfirmationEmail: vi.fn(() => Promise.resolve({ status: 'sent', emailId: 'test-123' })),
}));

global.fetch = vi.fn();

describe('POST /api/admin/registrations/[id]/confirm-payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should confirm payment and send email for valid registration', async () => {
    const mockRegistration = {
      id: 'reg-123',
      name: 'John Doe',
      email: 'john@example.com',
      locale: 'en',
      status: 'pending',
      event_id: 1,
      audit_trail: null,
      events: {
        id: 1,
        title: '測試活動',
        title_en: 'Test Event',
        event_date: '2026-05-16T19:00:00Z',
        venue_location: 'TW',
        venue_name: 'Test Venue',
        venue_address: '123 Test St',
      },
    };

    const { fetchRows } = await import('@/lib/supabase-utils');
    (fetchRows as any).mockResolvedValue([mockRegistration]);

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const req = new NextRequest('http://localhost:3000/api/admin/registrations/reg-123/confirm-payment', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-admin' },
    });

    const context = { params: Promise.resolve({ id: 'reg-123' }) };
    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.message).toBe('Payment confirmed and email sent');

    // Verify registration status and audit trail were updated in single PATCH
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/registrations?id=eq.reg-123'),
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"status":"confirmed"'),
      })
    );

    // Verify audit trail was included in the PATCH body (not a separate POST)
    const patchCall = (global.fetch as any).mock.calls.find((call: any) =>
      call[0].includes('/registrations?id=eq.reg-123') &&
      call[1]?.method === 'PATCH'
    );
    expect(patchCall).toBeDefined();
    const patchBody = JSON.parse(patchCall[1].body);
    expect(patchBody.audit_trail).toBeDefined();
    expect(patchBody.audit_trail).toHaveLength(1);
    expect(patchBody.audit_trail[0].event).toBe('admin_confirmed_payment');
    expect(patchBody.audit_trail[0].summary).toBe('Payment confirmed by admin');

    // Verify email was sent
    const { sendPaymentConfirmationEmail } = await import('@/lib/email-service');
    expect(sendPaymentConfirmationEmail).toHaveBeenCalledWith({
      locale: 'en',
      name: 'John Doe',
      email: 'john@example.com',
      eventTitle: '測試活動',
      eventTitleEn: 'Test Event',
      eventDate: '2026-05-16T19:00:00Z',
      eventLocation: 'TW',
      venueName: 'Test Venue',
      venueAddress: '123 Test St',
      registrationId: 'reg-123',
      eventId: 1,
    });
  });

  it('should return 404 when registration not found', async () => {
    const { fetchRows } = await import('@/lib/supabase-utils');
    (fetchRows as any).mockResolvedValue([]);

    const req = new NextRequest('http://localhost:3000/api/admin/registrations/invalid-id/confirm-payment', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-admin' },
    });

    const context = { params: Promise.resolve({ id: 'invalid-id' }) };
    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Registration not found');
  });

  it('should reject confirmation for non-created status', async () => {
    const mockRegistration = {
      id: 'reg-123',
      name: 'John Doe',
      email: 'john@example.com',
      locale: 'en',
      status: 'confirmed',
      event_id: 1,
      audit_trail: null,
      events: {
        id: 1,
        title: '測試活動',
        title_en: 'Test Event',
        event_date: '2026-05-16T19:00:00Z',
        venue_location: 'TW',
        venue_name: 'Test Venue',
        venue_address: '123 Test St',
      },
    };

    const { fetchRows } = await import('@/lib/supabase-utils');
    (fetchRows as any).mockResolvedValue([mockRegistration]);

    const req = new NextRequest('http://localhost:3000/api/admin/registrations/reg-123/confirm-payment', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-admin' },
    });

    const context = { params: Promise.resolve({ id: 'reg-123' }) };
    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("Cannot confirm payment for registration with status 'confirmed'");
  });

  it('should return 401 when not authorized', async () => {
    const { isAuthorizedAdminRequest } = await import('@/lib/admin-auth');
    (isAuthorizedAdminRequest as any).mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/admin/registrations/reg-123/confirm-payment', {
      method: 'POST',
    });

    const context = { params: Promise.resolve({ id: 'reg-123' }) };
    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should handle database update failure', async () => {
    const { isAuthorizedAdminRequest } = await import('@/lib/admin-auth');
    (isAuthorizedAdminRequest as any).mockResolvedValue(true);

    const mockRegistration = {
      id: 'reg-123',
      name: 'John Doe',
      email: 'john@example.com',
      locale: 'en',
      status: 'pending',
      event_id: 1,
      audit_trail: null,
      events: {
        id: 1,
        title: '測試活動',
        title_en: 'Test Event',
        event_date: '2026-05-16T19:00:00Z',
        venue_location: 'TW',
        venue_name: 'Test Venue',
        venue_address: '123 Test St',
      },
    };

    const { fetchRows } = await import('@/lib/supabase-utils');
    (fetchRows as any).mockResolvedValue([mockRegistration]);

    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/registrations/reg-123/confirm-payment', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-admin' },
    });

    const context = { params: Promise.resolve({ id: 'reg-123' }) };
    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(data.error).toBeTruthy();
  });
});
