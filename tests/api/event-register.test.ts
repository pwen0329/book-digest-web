import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/event/[slug]/register/route';

// Mock all dependencies
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/events', () => ({
  getEventBySlug: vi.fn(),
  calculateRegistrationStatus: vi.fn(),
}));

vi.mock('@/lib/registration-store', () => ({
  createRegistrationReservation: vi.fn(),
  updateRegistrationReservation: vi.fn(),
  countActiveRegistrationsByEventId: vi.fn(),
}));

vi.mock('@/lib/turnstile', () => ({
  verifyTurnstileToken: vi.fn(),
}));

vi.mock('@/lib/email-service', () => ({
  sendRegistrationSuccessEmail: vi.fn(),
}));

vi.mock('@/lib/observability', () => ({
  runWithRequestTrace: vi.fn((req, name, fn) => fn()),
  logServerError: vi.fn(),
}));


vi.mock('@/lib/http-response', () => ({
  getRetryAfterSeconds: vi.fn((ms) => String(Math.ceil(ms / 1000))),
}));

vi.mock('@/lib/signup', () => ({
  parseApiReferral: vi.fn((val) => val),
}));

import { rateLimit } from '@/lib/rate-limit';
import { getEventBySlug, calculateRegistrationStatus } from '@/lib/events';
import {
  createRegistrationReservation,
  updateRegistrationReservation,
  countActiveRegistrationsByEventId,
} from '@/lib/registration-store';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { sendRegistrationSuccessEmail } from '@/lib/email-service';
import { EventRegistrationStatus } from '@/types/event';
import type { Event } from '@/types/event';

describe('/api/event/[slug]/register', () => {
  const mockEvent: Event = {
    id: 1,
    slug: 'test-event',
    eventTypeCode: 'MANDARIN_BOOK_CLUB',
    venueName: 'Test Venue',
    venueCapacity: 20,
    venueLocation: 'TW',
    venueAddress: 'Test Address',
    paymentAmount: 0,
    paymentCurrency: 'TWD',
    title: 'Test Event',
    eventDate: '2026-06-01T18:00:00Z',
    registrationOpensAt: '2026-04-01T00:00:00Z',
    registrationClosesAt: '2026-05-30T23:59:59Z',
    isPublished: true,
    introTemplateName: 'default_paid',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const validPayload = {
    locale: 'en',
    name: 'Test User',
    age: 25,
    profession: 'Engineer',
    email: 'test@example.com',
    referral: 'Instagram',
    turnstileToken: 'valid-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
  });

  describe('Rate limiting', () => {
    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterMs: 60000 });

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        headers: { 'x-forwarded-for': '1.2.3.4' },
        body: JSON.stringify(validPayload),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many requests');
      expect(response.headers.get('Retry-After')).toBeDefined();
    });
  });

  describe('Event validation', () => {
    it('returns 404 for non-existent event', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/event/non-existent/register', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'non-existent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Event not found');
    });

    it('returns 404 for unpublished event', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce({
        ...mockEvent,
        isPublished: false,
      });

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Event not found');
    });
  });

  describe('Registration status', () => {
    it('returns 409 when registration is UPCOMING', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(mockEvent);
      vi.mocked(countActiveRegistrationsByEventId).mockResolvedValueOnce(0);
      vi.mocked(calculateRegistrationStatus).mockResolvedValueOnce(EventRegistrationStatus.UPCOMING);

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Registration not open yet');
      expect(data.reason).toBe('upcoming');
    });

    it('returns 409 when registration is CLOSED', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(mockEvent);
      vi.mocked(countActiveRegistrationsByEventId).mockResolvedValueOnce(0);
      vi.mocked(calculateRegistrationStatus).mockResolvedValueOnce(EventRegistrationStatus.CLOSED);

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Registration closed');
      expect(data.reason).toBe('closed');
    });

    it('returns 409 when registration is FULL', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(mockEvent);
      vi.mocked(countActiveRegistrationsByEventId).mockResolvedValueOnce(20);
      vi.mocked(calculateRegistrationStatus).mockResolvedValueOnce(EventRegistrationStatus.FULL);

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Registration closed');
      expect(data.reason).toBe('closed');
    });
  });

  describe('Payload validation', () => {
    it('returns 400 for invalid JSON', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(mockEvent);
      vi.mocked(countActiveRegistrationsByEventId).mockResolvedValueOnce(0);
      vi.mocked(calculateRegistrationStatus).mockResolvedValueOnce(EventRegistrationStatus.OPEN);

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: 'invalid json',
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON payload');
    });

    it('returns 400 for missing required fields', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(mockEvent);
      vi.mocked(countActiveRegistrationsByEventId).mockResolvedValueOnce(0);
      vi.mocked(calculateRegistrationStatus).mockResolvedValueOnce(EventRegistrationStatus.OPEN);

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', age: 25 }), // Missing email, profession, referral
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid payload');
    });

    it('returns 400 for invalid email format', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(mockEvent);
      vi.mocked(countActiveRegistrationsByEventId).mockResolvedValueOnce(0);
      vi.mocked(calculateRegistrationStatus).mockResolvedValueOnce(EventRegistrationStatus.OPEN);

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: JSON.stringify({
          ...validPayload,
          email: 'invalid-email',
        }),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email');
    });

    it('returns 400 for age out of range', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(mockEvent);
      vi.mocked(countActiveRegistrationsByEventId).mockResolvedValueOnce(0);
      vi.mocked(calculateRegistrationStatus).mockResolvedValueOnce(EventRegistrationStatus.OPEN);

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: JSON.stringify({
          ...validPayload,
          age: 12, // Below minimum
        }),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid age');
    });

    it('returns 400 for invalid bank account format', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(mockEvent);
      vi.mocked(countActiveRegistrationsByEventId).mockResolvedValueOnce(0);
      vi.mocked(calculateRegistrationStatus).mockResolvedValueOnce(EventRegistrationStatus.OPEN);

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: JSON.stringify({
          ...validPayload,
          bankAccount: '123', // Must be 5 digits
        }),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid bank account');
    });
  });

  describe('Honeypot', () => {
    it('returns success for bot requests with website field', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(mockEvent);
      vi.mocked(countActiveRegistrationsByEventId).mockResolvedValueOnce(0);
      vi.mocked(calculateRegistrationStatus).mockResolvedValueOnce(EventRegistrationStatus.OPEN);

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: JSON.stringify({
          ...validPayload,
          website: 'http://bot-site.com', // Honeypot field
        }),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  describe('Turnstile verification', () => {
    it('returns 403 when Turnstile verification fails', async () => {
      vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret-key');
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(mockEvent);
      vi.mocked(countActiveRegistrationsByEventId).mockResolvedValueOnce(0);
      vi.mocked(calculateRegistrationStatus).mockResolvedValueOnce(EventRegistrationStatus.OPEN);
      vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(false);

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Bot verification failed');
    });

    it('passes when Turnstile verification succeeds', async () => {
      vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret-key');
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(mockEvent);
      vi.mocked(countActiveRegistrationsByEventId).mockResolvedValueOnce(0);
      vi.mocked(calculateRegistrationStatus).mockResolvedValueOnce(EventRegistrationStatus.OPEN);
      vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(true);
      vi.mocked(createRegistrationReservation).mockResolvedValueOnce({
        id: 'reg-123',
        eventId: 1,
        ...validPayload,
        locale: 'en' as 'en' | 'zh',
        age: 25,
        referral: 'Instagram',
        timestamp: '2026-01-01T00:00:00Z',
        status: 'pending',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });

      expect(response.status).toBe(201);
      expect(verifyTurnstileToken).toHaveBeenCalled();
    });
  });

  describe('Successful registration', () => {
    it('creates reservation and returns 201', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(mockEvent);
      vi.mocked(countActiveRegistrationsByEventId).mockResolvedValueOnce(0);
      vi.mocked(calculateRegistrationStatus).mockResolvedValueOnce(EventRegistrationStatus.OPEN);
      vi.mocked(createRegistrationReservation).mockResolvedValueOnce({
        id: 'reg-123',
        eventId: 1,
        ...validPayload,
        locale: 'en' as 'en' | 'zh',
        age: 25,
        referral: 'Instagram',
        timestamp: '2026-01-01T00:00:00Z',
        status: 'pending',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.ok).toBe(true);
      expect(data.id).toBe('reg-123');
      expect(createRegistrationReservation).toHaveBeenCalled();
    });

    it('accepts firstName and lastName fields', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 });
      vi.mocked(getEventBySlug).mockResolvedValueOnce(mockEvent);
      vi.mocked(countActiveRegistrationsByEventId).mockResolvedValueOnce(0);
      vi.mocked(calculateRegistrationStatus).mockResolvedValueOnce(EventRegistrationStatus.OPEN);
      vi.mocked(createRegistrationReservation).mockResolvedValueOnce({
        id: 'reg-123',
        eventId: 1,
        locale: 'en',
        name: 'John Doe',
        age: 25,
        profession: 'Engineer',
        email: 'test@example.com',
        referral: 'Instagram',
        timestamp: '2026-01-01T00:00:00Z',
        status: 'pending',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });

      const request = new NextRequest('http://localhost/api/event/test-event/register', {
        method: 'POST',
        body: JSON.stringify({
          ...validPayload,
          name: undefined,
          firstName: 'John',
          lastName: 'Doe',
        }),
      });
      const response = await POST(request, { params: Promise.resolve({ slug: 'test-event' }) });

      expect(response.status).toBe(201);
      expect(createRegistrationReservation).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
        })
      );
    });
  });
});
