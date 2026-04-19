// Unit tests for POST /api/admin/send-email
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/send-email/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/observability', () => ({
  runWithRequestTrace: vi.fn((req, name, fn) => fn()),
}));

vi.mock('@/lib/admin-auth', () => ({
  isAuthorizedAdminRequest: vi.fn(),
}));

vi.mock('@/lib/email-service', () => ({
  sendRegistrationSuccessEmail: vi.fn(),
  sendPaymentConfirmationEmail: vi.fn(),
}));

vi.mock('@/lib/events', () => ({
  getEventById: vi.fn(),
}));

vi.mock('@/lib/registration-store', () => ({
  listStoredRegistrations: vi.fn(),
}));

import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { sendRegistrationSuccessEmail, sendPaymentConfirmationEmail } from '@/lib/email-service';
import { getEventById } from '@/lib/events';
import { listStoredRegistrations } from '@/lib/registration-store';

describe('POST /api/admin/send-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Authorization Tests
  // ============================================================================

  it('should return 401 if not authorized', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({ eventId: 1, emailType: 'reservation_confirmation' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  // ============================================================================
  // Request Body Validation Tests
  // ============================================================================

  it('should return 400 if request body is not JSON object', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify('not an object'),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Request body must be a JSON object');
  });

  it('should return 400 if eventId is missing', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({ emailType: 'reservation_confirmation' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Missing required field: eventId');
  });

  it('should return 400 if eventId is not a positive integer', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({ eventId: -1, emailType: 'reservation_confirmation' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('eventId must be a positive integer');
  });

  it('should return 400 if emailType is missing', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({ eventId: 1 }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Missing required field: emailType');
  });

  it('should return 400 if emailType is invalid', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({ eventId: 1, emailType: 'invalid_type' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('emailType must be');
  });

  it('should return 400 if recipientEmail is invalid', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'reservation_confirmation',
        recipientEmail: 'invalid-email',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('recipientEmail must be a valid email address');
  });

  it('should return 400 if recipientLocale is invalid', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'reservation_confirmation',
        recipientEmail: 'test@example.com',
        recipientLocale: 'fr',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('recipientLocale must be');
  });

  it('should return 400 if unexpected fields are present', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'reservation_confirmation',
        extraField: 'unexpected',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Unexpected fields');
  });

  // ============================================================================
  // Event Not Found Tests
  // ============================================================================

  it('should return 404 if event does not exist', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({ eventId: 999, emailType: 'reservation_confirmation' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('Event with id 999 not found');
  });

  it('should return 400 if event has no venue', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockResolvedValue({
      id: 1,
      title: 'Test Event',
      titleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      venueId: 1,
      venue: undefined,
    } as any);

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({ eventId: 1, emailType: 'reservation_confirmation' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('has no associated venue');
  });

  // ============================================================================
  // Test Mode - Reservation Confirmation Tests
  // ============================================================================

  it('should send test reservation confirmation email successfully', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockResolvedValue({
      id: 1,
      title: '測試活動',
      titleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      venueId: 1,
      venue: { id: 1, location: 'TW', name: 'Test Venue', address: '123 Test St' },
    } as any);
    vi.mocked(sendRegistrationSuccessEmail).mockResolvedValue({
      status: 'sent',
      emailId: 'test-email-id',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'reservation_confirmation',
        recipientEmail: 'test@example.com',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.mode).toBe('test');
    expect(data.sent).toBe(1);
    expect(data.failed).toBe(0);
    expect(data.skipped).toBe(0);

    expect(sendRegistrationSuccessEmail).toHaveBeenCalledWith({
      locale: 'en',
      name: 'Test User',
      email: 'test@example.com',
      eventTitle: '測試活動',
      eventTitleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      eventLocation: 'TW',
      venueName: 'Test Venue',
      venueAddress: '123 Test St',
      registrationId: 'test',
      eventId: 1,
    });
  });

  it('should send test reservation confirmation email with zh locale', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockResolvedValue({
      id: 1,
      title: '測試活動',
      titleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      venueId: 1,
      venue: { id: 1, location: 'TW', name: 'Test Venue', address: '123 Test St' },
    } as any);
    vi.mocked(sendRegistrationSuccessEmail).mockResolvedValue({
      status: 'sent',
      emailId: 'test-email-id',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'reservation_confirmation',
        recipientEmail: 'test@example.com',
        recipientLocale: 'zh',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);

    expect(sendRegistrationSuccessEmail).toHaveBeenCalledWith({
      locale: 'zh',
      name: '測試用戶',
      email: 'test@example.com',
      eventTitle: '測試活動',
      eventTitleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      eventLocation: 'TW',
      venueName: 'Test Venue',
      venueAddress: '123 Test St',
      registrationId: 'test',
      eventId: 1,
    });
  });

  // ============================================================================
  // Test Mode - Payment Confirmation Tests
  // ============================================================================

  it('should send test payment confirmation email successfully', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockResolvedValue({
      id: 1,
      title: '測試活動',
      titleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      venueId: 1,
      venue: { id: 1, location: 'TW', name: 'Test Venue', address: '123 Test St' },
    } as any);
    vi.mocked(sendPaymentConfirmationEmail).mockResolvedValue({
      status: 'sent',
      emailId: 'test-email-id',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'payment_confirmation',
        recipientEmail: 'test@example.com',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.mode).toBe('test');
    expect(data.sent).toBe(1);

    expect(sendPaymentConfirmationEmail).toHaveBeenCalledWith({
      locale: 'en',
      name: 'Test User',
      email: 'test@example.com',
      eventTitle: '測試活動',
      eventTitleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      eventLocation: 'TW',
      venueName: 'Test Venue',
      venueAddress: '123 Test St',
      registrationId: 'test',
      eventId: 1,
    });
  });

  it('should send test payment confirmation email with zh locale', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockResolvedValue({
      id: 1,
      title: '測試活動',
      titleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      venueId: 1,
      venue: { id: 1, location: 'TW', name: 'Test Venue', address: '123 Test St' },
    } as any);
    vi.mocked(sendPaymentConfirmationEmail).mockResolvedValue({
      status: 'sent',
      emailId: 'test-email-id',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'payment_confirmation',
        recipientEmail: 'test@example.com',
        recipientLocale: 'zh',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    expect(sendPaymentConfirmationEmail).toHaveBeenCalledWith({
      locale: 'zh',
      name: '測試用戶',
      email: 'test@example.com',
      eventTitle: '測試活動',
      eventTitleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      eventLocation: 'TW',
      venueName: 'Test Venue',
      venueAddress: '123 Test St',
      registrationId: 'test',
      eventId: 1,
    });
  });

  it('should handle test email that fails', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockResolvedValue({
      id: 1,
      title: 'Test Event',
      titleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      venueId: 1,
      venue: { id: 1, location: 'TW', name: 'Test Venue', address: '123 Test St' },
    } as any);
    vi.mocked(sendRegistrationSuccessEmail).mockResolvedValue({
      status: 'failed',
      reason: 'SMTP error',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'reservation_confirmation',
        recipientEmail: 'test@example.com',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.sent).toBe(0);
    expect(data.failed).toBe(1);
    expect(data.skipped).toBe(0);
  });

  it('should handle test email that is skipped', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockResolvedValue({
      id: 1,
      title: 'Test Event',
      titleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      venueId: 1,
      venue: { id: 1, location: 'TW', name: 'Test Venue', address: '123 Test St' },
    } as any);
    vi.mocked(sendRegistrationSuccessEmail).mockResolvedValue({
      status: 'skipped',
      reason: 'Email provider not configured',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'reservation_confirmation',
        recipientEmail: 'test@example.com',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.sent).toBe(0);
    expect(data.failed).toBe(0);
    expect(data.skipped).toBe(1);
  });

  // ============================================================================
  // Broadcast Mode Tests
  // ============================================================================

  it('should send broadcast reservation confirmation emails successfully', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockResolvedValue({
      id: 1,
      title: '測試活動',
      titleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      venueId: 1,
      venue: { id: 1, location: 'TW', name: 'Test Venue', address: '123 Test St' },
    } as any);
    vi.mocked(listStoredRegistrations).mockResolvedValue([
      {
        id: 'reg1',
        eventId: 1,
        locale: 'zh',
        name: 'User 1',
        email: 'user1@example.com',
        age: 25,
        profession: 'Engineer',
        referral: 'friend',
        timestamp: '2026-04-01T10:00:00Z',
        status: 'confirmed',
        createdAt: '2026-04-01T10:00:00Z',
        updatedAt: '2026-04-01T10:00:00Z',
      },
      {
        id: 'reg2',
        eventId: 1,
        locale: 'en',
        name: 'User 2',
        email: 'user2@example.com',
        age: 30,
        profession: 'Designer',
        referral: 'social',
        timestamp: '2026-04-01T11:00:00Z',
        status: 'confirmed',
        createdAt: '2026-04-01T11:00:00Z',
        updatedAt: '2026-04-01T11:00:00Z',
      },
    ] as any);
    vi.mocked(sendRegistrationSuccessEmail).mockResolvedValue({
      status: 'sent',
      emailId: 'email-id',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'reservation_confirmation',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.mode).toBe('broadcast');
    expect(data.sent).toBe(2);
    expect(data.failed).toBe(0);
    expect(data.skipped).toBe(0);
    expect(data.total).toBe(2);

    expect(sendRegistrationSuccessEmail).toHaveBeenCalledTimes(2);
    expect(sendRegistrationSuccessEmail).toHaveBeenCalledWith({
      locale: 'zh',
      name: 'User 1',
      email: 'user1@example.com',
      eventTitle: '測試活動',
      eventTitleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      eventLocation: 'TW',
      venueName: 'Test Venue',
      venueAddress: '123 Test St',
      registrationId: 'reg1',
      eventId: 1,
    });
    expect(sendRegistrationSuccessEmail).toHaveBeenCalledWith({
      locale: 'en',
      name: 'User 2',
      email: 'user2@example.com',
      eventTitle: '測試活動',
      eventTitleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      eventLocation: 'TW',
      venueName: 'Test Venue',
      venueAddress: '123 Test St',
      registrationId: 'reg2',
      eventId: 1,
    });
  });

  it('should send broadcast payment confirmation emails successfully', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockResolvedValue({
      id: 1,
      title: '測試活動',
      titleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      venueId: 1,
      venue: { id: 1, location: 'TW', name: 'Test Venue', address: '123 Test St' },
    } as any);
    vi.mocked(listStoredRegistrations).mockResolvedValue([
      {
        id: 'reg1',
        eventId: 1,
        locale: 'zh',
        name: 'User 1',
        email: 'user1@example.com',
      },
    ] as any);
    vi.mocked(sendPaymentConfirmationEmail).mockResolvedValue({
      status: 'sent',
      emailId: 'email-id',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'payment_confirmation',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.mode).toBe('broadcast');
    expect(data.sent).toBe(1);

    expect(sendPaymentConfirmationEmail).toHaveBeenCalledWith({
      locale: 'zh',
      name: 'User 1',
      email: 'user1@example.com',
      eventTitle: '測試活動',
      eventTitleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      eventLocation: 'TW',
      venueName: 'Test Venue',
      venueAddress: '123 Test St',
      registrationId: 'reg1',
      eventId: 1,
    });
  });

  it('should handle broadcast with no registrations', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockResolvedValue({
      id: 1,
      title: 'Test Event',
      titleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      venueId: 1,
      venue: { id: 1, location: 'TW', name: 'Test Venue', address: '123 Test St' },
    } as any);
    vi.mocked(listStoredRegistrations).mockResolvedValue([]);

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'reservation_confirmation',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.mode).toBe('broadcast');
    expect(data.sent).toBe(0);
    expect(data.failed).toBe(0);
    expect(data.skipped).toBe(0);
    expect(data.message).toContain('No registrations found');
  });

  it('should handle broadcast with mixed success/failure', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockResolvedValue({
      id: 1,
      title: 'Test Event',
      titleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      venueId: 1,
      venue: { id: 1, location: 'TW', name: 'Test Venue', address: '123 Test St' },
    } as any);
    vi.mocked(listStoredRegistrations).mockResolvedValue([
      {
        id: 'reg1',
        eventId: 1,
        locale: 'en',
        name: 'User 1',
        email: 'user1@example.com',
      },
      {
        id: 'reg2',
        eventId: 1,
        locale: 'en',
        name: 'User 2',
        email: 'user2@example.com',
      },
      {
        id: 'reg3',
        eventId: 1,
        locale: 'en',
        name: 'User 3',
        email: 'user3@example.com',
      },
    ] as any);

    vi.mocked(sendRegistrationSuccessEmail)
      .mockResolvedValueOnce({ status: 'sent', emailId: 'id1' })
      .mockResolvedValueOnce({ status: 'failed', reason: 'SMTP error' })
      .mockResolvedValueOnce({ status: 'skipped', reason: 'Provider not configured' });

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'reservation_confirmation',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.mode).toBe('broadcast');
    expect(data.sent).toBe(1);
    expect(data.failed).toBe(1);
    expect(data.skipped).toBe(1);
    expect(data.total).toBe(3);
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  it('should return 500 if getEventById throws unexpected error', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockRejectedValue(new Error('Database connection failed'));

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({ eventId: 1, emailType: 'reservation_confirmation' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain('Database connection failed');
  });

  it('should return 500 if listStoredRegistrations throws error', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEventById).mockResolvedValue({
      id: 1,
      title: 'Test Event',
      titleEn: 'Test Event',
      eventDate: '2026-05-01T19:00:00Z',
      venueId: 1,
      venue: { id: 1, location: 'TW', name: 'Test Venue', address: '123 Test St' },
    } as any);
    vi.mocked(listStoredRegistrations).mockRejectedValue(new Error('Database error'));

    const req = new NextRequest('http://localhost:3000/api/admin/send-email', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 1,
        emailType: 'reservation_confirmation',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain('Database error');
  });
});
