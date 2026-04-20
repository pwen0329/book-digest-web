import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/registrations/[id]/cancel/route';
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
  sendEmail: vi.fn(() => Promise.resolve({ status: 'sent', emailId: 'test-123' })),
}));

global.fetch = vi.fn();

describe('POST /api/admin/registrations/[id]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should cancel registration without sending email', async () => {
    const mockRegistration = {
      id: 'reg-123',
      name: 'John Doe',
      email: 'john@example.com',
      status: 'created',
      audit_trail: null,
    };

    const { fetchRows } = await import('@/lib/supabase-utils');
    (fetchRows as any).mockResolvedValue([mockRegistration]);

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const req = new NextRequest('http://localhost:3000/api/admin/registrations/reg-123/cancel', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-admin' },
      body: JSON.stringify({ emailContent: null }),
    });

    const context = { params: Promise.resolve({ id: 'reg-123' }) };
    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.message).toBe('Registration cancelled without email');

    // Verify registration status and audit trail were updated in single PATCH
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/registrations?id=eq.reg-123'),
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"status":"cancelled"'),
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
    expect(patchBody.audit_trail[0].event).toBe('admin_cancelled');
    expect(patchBody.audit_trail[0].summary).toContain('without email notification');
  });

  it('should cancel registration and send email', async () => {
    const mockRegistration = {
      id: 'reg-123',
      name: 'John Doe',
      email: 'john@example.com',
      status: 'created',
      audit_trail: [{ event: 'created', actor: 'system', at: '2024-01-01T00:00:00Z', summary: 'Registration created' }],
    };

    const { fetchRows } = await import('@/lib/supabase-utils');
    (fetchRows as any).mockResolvedValue([mockRegistration]);

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const { sendEmail } = await import('@/lib/email-service');
    (sendEmail as any).mockResolvedValue({ status: 'sent', emailId: 'test-123' });

    const req = new NextRequest('http://localhost:3000/api/admin/registrations/reg-123/cancel', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-admin' },
      body: JSON.stringify({
        emailContent: 'Your registration has been cancelled.',
        emailSubject: 'Cancellation Notice'
      }),
    });

    const context = { params: Promise.resolve({ id: 'reg-123' }) };
    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.message).toBe('Registration cancelled and email sent');

    // Verify email was sent
    expect(sendEmail).toHaveBeenCalledWith(
      'john@example.com',
      'Cancellation Notice',
      'Your registration has been cancelled.',
      expect.any(String)
    );

    // Verify audit trail was appended to existing entries
    const patchCall = (global.fetch as any).mock.calls.find((call: any) =>
      call[0].includes('/registrations?id=eq.reg-123') &&
      call[1]?.method === 'PATCH'
    );
    expect(patchCall).toBeDefined();
    const patchBody = JSON.parse(patchCall[1].body);
    expect(patchBody.audit_trail).toHaveLength(2); // Original 'created' + new 'admin_cancelled'
    expect(patchBody.audit_trail[1].event).toBe('admin_cancelled');
    expect(patchBody.audit_trail[1].summary).toContain('with email notification');
  });

  it('should return 404 when registration not found', async () => {
    const { fetchRows } = await import('@/lib/supabase-utils');
    (fetchRows as any).mockResolvedValue([]);

    const req = new NextRequest('http://localhost:3000/api/admin/registrations/invalid-id/cancel', {
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

  it('should reject cancellation for already cancelled registration', async () => {
    const mockRegistration = {
      id: 'reg-123',
      name: 'John Doe',
      email: 'john@example.com',
      status: 'cancelled',
      audit_trail: null,
    };

    const { fetchRows } = await import('@/lib/supabase-utils');
    (fetchRows as any).mockResolvedValue([mockRegistration]);

    const req = new NextRequest('http://localhost:3000/api/admin/registrations/reg-123/cancel', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-admin' },
    });

    const context = { params: Promise.resolve({ id: 'reg-123' }) };
    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('already cancelled');
  });

  it('should return 401 when not authorized', async () => {
    const { isAuthorizedAdminRequest } = await import('@/lib/admin-auth');
    (isAuthorizedAdminRequest as any).mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/admin/registrations/reg-123/cancel', {
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
      status: 'created',
      audit_trail: null,
    };

    const { fetchRows } = await import('@/lib/supabase-utils');
    (fetchRows as any).mockResolvedValue([mockRegistration]);

    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/registrations/reg-123/cancel', {
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
