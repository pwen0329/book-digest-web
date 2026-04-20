import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendRegistrationSuccessEmail, sendPaymentConfirmationEmail } from '@/lib/email-service';

// Mock dependencies
vi.mock('@/lib/supabase-utils', () => ({
  getSupabaseUrl: vi.fn(() => 'http://localhost:54321'),
  getSupabaseHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
}));

vi.mock('@/lib/email-templates', () => ({
  getRegistrationSuccessEmailTemplates: vi.fn(() => Promise.resolve({
    templates: {
      en: { subject: 'Registration Confirmed', body: 'Hello {{name}}' },
      zh: { subject: '註冊確認', body: '您好 {{name}}' },
    },
  })),
  getPaymentConfirmationEmailTemplates: vi.fn(() => Promise.resolve({
    templates: {
      en: { subject: 'Payment Confirmed', body: 'Hello {{name}}' },
      zh: { subject: '付款確認', body: '您好 {{name}}' },
    },
  })),
  interpolateEmailTemplate: vi.fn((template, context) => ({
    subject: template.subject.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || ''),
    body: template.body.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || ''),
  })),
}));

vi.mock('@/lib/date-utils', () => ({
  formatEventDate: vi.fn(() => 'May 1, 2026 at 7:00 PM'),
}));

vi.mock('@/lib/env', () => ({
  CLIENT_ENV: {
    SITE_URL: 'http://localhost:3000',
  },
  EMAIL_CONFIG: {
    RESEND_API_KEY: 'test-key',
    REGISTRATION_EMAIL_FROM: 'test@example.com',
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('Email Service - Registration ID Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful responses for all fetch calls
    (global.fetch as any).mockImplementation((url: string) => {
      // Email settings request
      if (url.includes('/settings')) {
        return Promise.resolve({
          ok: true,
          json: async () => ([{ value: 'true' }]),
        });
      }
      // Email sending (Resend API)
      if (url.includes('resend') || url.includes('email')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'test-email-id' }),
        });
      }
      // Email audit logging
      if (url.includes('/email_audit')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  describe('sendRegistrationSuccessEmail', () => {
    it('should accept null registrationId for test emails', async () => {
      const input = {
        locale: 'en' as const,
        name: 'Test User',
        email: 'test@example.com',
        eventTitle: 'Test Event',
        eventTitleEn: 'Test Event',
        eventDate: '2026-05-01T19:00:00Z',
        eventLocation: 'TW',
        venueName: 'Test Venue',
        venueAddress: '123 Test St',
        registrationId: null,
        eventId: 1,
      };

      await sendRegistrationSuccessEmail(input);

      // Verify email_audit was called with null registration_id
      const auditCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) => call[0].includes('/email_audit')
      );
      expect(auditCalls).toHaveLength(1);

      const auditBody = JSON.parse(auditCalls[0][1].body);
      expect(auditBody.registration_id).toBeNull();
      expect(auditBody.event_id).toBe(1);
      expect(auditBody.email_type).toBe('test');
    });

    it('should accept valid registrationId string', async () => {
      const input = {
        locale: 'en' as const,
        name: 'Test User',
        email: 'test@example.com',
        eventTitle: 'Test Event',
        eventTitleEn: 'Test Event',
        eventDate: '2026-05-01T19:00:00Z',
        eventLocation: 'TW',
        venueName: 'Test Venue',
        venueAddress: '123 Test St',
        registrationId: 'reg-abc-123',
        eventId: 1,
      };

      await sendRegistrationSuccessEmail(input);

      // Verify email_audit was called with the registration_id
      const auditCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) => call[0].includes('/email_audit')
      );
      expect(auditCalls).toHaveLength(1);

      const auditBody = JSON.parse(auditCalls[0][1].body);
      expect(auditBody.registration_id).toBe('reg-abc-123');
      expect(auditBody.event_id).toBe(1);
      expect(auditBody.email_type).toBe('reservation_confirmation');
    });

    it('should use "test" email type when registrationId is null', async () => {
      const input = {
        locale: 'zh' as const,
        name: '測試用戶',
        email: 'test@example.com',
        eventTitle: '測試活動',
        eventDate: '2026-05-01T19:00:00Z',
        eventLocation: 'TW',
        venueName: 'Test Venue',
        registrationId: null,
        eventId: 2,
      };

      await sendRegistrationSuccessEmail(input);

      const auditCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) => call[0].includes('/email_audit')
      );
      const auditBody = JSON.parse(auditCalls[0][1].body);
      expect(auditBody.email_type).toBe('test');
    });

    it('should use "reservation_confirmation" email type when registrationId is provided', async () => {
      const input = {
        locale: 'zh' as const,
        name: '測試用戶',
        email: 'test@example.com',
        eventTitle: '測試活動',
        eventDate: '2026-05-01T19:00:00Z',
        eventLocation: 'TW',
        venueName: 'Test Venue',
        registrationId: 'real-reg-id',
        eventId: 2,
      };

      await sendRegistrationSuccessEmail(input);

      const auditCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) => call[0].includes('/email_audit')
      );
      const auditBody = JSON.parse(auditCalls[0][1].body);
      expect(auditBody.email_type).toBe('reservation_confirmation');
    });
  });

  describe('sendPaymentConfirmationEmail', () => {
    it('should accept null registrationId for test emails', async () => {
      const input = {
        locale: 'en' as const,
        name: 'Test User',
        email: 'test@example.com',
        eventTitle: 'Test Event',
        eventTitleEn: 'Test Event',
        eventDate: '2026-05-01T19:00:00Z',
        eventLocation: 'TW',
        venueName: 'Test Venue',
        venueAddress: '123 Test St',
        registrationId: null,
        eventId: 1,
      };

      await sendPaymentConfirmationEmail(input);

      // Verify email_audit was called with null registration_id
      const auditCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) => call[0].includes('/email_audit')
      );
      expect(auditCalls).toHaveLength(1);

      const auditBody = JSON.parse(auditCalls[0][1].body);
      expect(auditBody.registration_id).toBeNull();
      expect(auditBody.event_id).toBe(1);
      expect(auditBody.email_type).toBe('test');
    });

    it('should accept valid registrationId string', async () => {
      const input = {
        locale: 'en' as const,
        name: 'Test User',
        email: 'test@example.com',
        eventTitle: 'Test Event',
        eventTitleEn: 'Test Event',
        eventDate: '2026-05-01T19:00:00Z',
        eventLocation: 'TW',
        venueName: 'Test Venue',
        venueAddress: '123 Test St',
        registrationId: 'reg-xyz-789',
        eventId: 1,
      };

      await sendPaymentConfirmationEmail(input);

      // Verify email_audit was called with the registration_id
      const auditCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) => call[0].includes('/email_audit')
      );
      expect(auditCalls).toHaveLength(1);

      const auditBody = JSON.parse(auditCalls[0][1].body);
      expect(auditBody.registration_id).toBe('reg-xyz-789');
      expect(auditBody.event_id).toBe(1);
      expect(auditBody.email_type).toBe('payment_confirmation');
    });

    it('should use "test" email type when registrationId is null', async () => {
      const input = {
        locale: 'zh' as const,
        name: '測試用戶',
        email: 'test@example.com',
        eventTitle: '測試活動',
        eventDate: '2026-05-01T19:00:00Z',
        eventLocation: 'TW',
        venueName: 'Test Venue',
        registrationId: null,
        eventId: 3,
      };

      await sendPaymentConfirmationEmail(input);

      const auditCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) => call[0].includes('/email_audit')
      );
      const auditBody = JSON.parse(auditCalls[0][1].body);
      expect(auditBody.email_type).toBe('test');
    });

    it('should use "payment_confirmation" email type when registrationId is provided', async () => {
      const input = {
        locale: 'zh' as const,
        name: '測試用戶',
        email: 'test@example.com',
        eventTitle: '測試活動',
        eventDate: '2026-05-01T19:00:00Z',
        eventLocation: 'TW',
        venueName: 'Test Venue',
        registrationId: 'real-payment-id',
        eventId: 3,
      };

      await sendPaymentConfirmationEmail(input);

      const auditCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) => call[0].includes('/email_audit')
      );
      const auditBody = JSON.parse(auditCalls[0][1].body);
      expect(auditBody.email_type).toBe('payment_confirmation');
    });
  });

  describe('Email audit logging - FK constraint validation', () => {
    it('should not attempt to insert invalid registration_id that violates FK constraint', async () => {
      const input = {
        locale: 'en' as const,
        name: 'Test User',
        email: 'test@example.com',
        eventTitle: 'Test Event',
        eventDate: '2026-05-01T19:00:00Z',
        eventLocation: 'TW',
        venueName: 'Test Venue',
        registrationId: null, // Must be null or valid ID, never an invalid string
        eventId: 1,
      };

      await sendRegistrationSuccessEmail(input);

      const auditCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) => call[0].includes('/email_audit')
      );
      const auditBody = JSON.parse(auditCalls[0][1].body);

      // Verify we're not passing invalid strings that would violate FK constraint
      expect(auditBody.registration_id).not.toBe('test');
      expect(auditBody.registration_id).not.toBe('invalid');
      expect(auditBody.registration_id).not.toBe('');
      // Should be either null or a valid registration ID
      expect(
        auditBody.registration_id === null || typeof auditBody.registration_id === 'string'
      ).toBe(true);
    });
  });
});
