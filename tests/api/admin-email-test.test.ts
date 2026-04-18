// Related to FEATURE-001
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/email-test/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/observability', () => ({
  runWithRequestTrace: vi.fn((req, name, fn) => fn()),
}));

vi.mock('@/lib/email-service', () => ({
  sendTestEmail: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  isAuthorizedAdminRequest: vi.fn(),
}));

import { sendTestEmail } from '@/lib/email-service';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';

describe('POST /api/admin/email-test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authorized', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/admin/email-test', {
      method: 'POST',
      body: JSON.stringify({ recipientEmail: 'test@example.com' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 if invalid token', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/admin/email-test', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-token' },
      body: JSON.stringify({ recipientEmail: 'test@example.com' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('should return 400 if recipientEmail missing', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/email-test', {
      method: 'POST',
      body: JSON.stringify({ emailType: 'payment_confirmation' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('recipientEmail is required');
  });

  it('should return 400 if invalid email format', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/email-test', {
      method: 'POST',
      body: JSON.stringify({ recipientEmail: 'invalid-email' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid email format');
  });

  it('should send test email successfully', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(sendTestEmail).mockResolvedValue({
      status: 'sent',
      emailId: 'test-email-id',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/email-test', {
      method: 'POST',
      body: JSON.stringify({
        recipientEmail: 'test@example.com',
        emailType: 'payment_confirmation',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.message).toContain('test@example.com');

    expect(sendTestEmail).toHaveBeenCalledWith({
      recipientEmail: 'test@example.com',
      emailType: 'payment_confirmation',
    });
  });

  it('should default to reservation_confirmation if emailType invalid', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(sendTestEmail).mockResolvedValue({
      status: 'sent',
      emailId: 'test-email-id',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/email-test', {
      method: 'POST',
      body: JSON.stringify({
        recipientEmail: 'test@example.com',
        emailType: 'invalid_type',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    expect(sendTestEmail).toHaveBeenCalledWith({
      recipientEmail: 'test@example.com',
      emailType: 'reservation_confirmation',
    });
  });

  it('should return 503 if email skipped', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(sendTestEmail).mockResolvedValue({
      status: 'skipped',
      reason: 'Resend API key not configured',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/email-test', {
      method: 'POST',
      body: JSON.stringify({ recipientEmail: 'test@example.com' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.message).toContain('Resend API key not configured');
  });

  it('should return 500 if email failed', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(sendTestEmail).mockResolvedValue({
      status: 'failed',
      reason: 'SMTP error',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/email-test', {
      method: 'POST',
      body: JSON.stringify({ recipientEmail: 'test@example.com' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.message).toContain('SMTP error');
  });
});
