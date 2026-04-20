'use client';

import { useState, useEffect } from 'react';
import type {
  EmailLocale,
  RegistrationSuccessEmailTemplates,
  PaymentConfirmationEmailTemplates,
} from '@/lib/email-templates';

type EmailManagerProps = {
  initialEmailTemplates: {
    registration: RegistrationSuccessEmailTemplates;
    payment: PaymentConfirmationEmailTemplates;
  };
  events: Array<{ id: number; title: string; titleEn: string }>;
};

export default function EmailManager({ initialEmailTemplates, events }: EmailManagerProps) {
  // Message/error state
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);

  // Registration email templates state
  const [registrationEmails, setRegistrationEmails] = useState(initialEmailTemplates.registration);

  // Email settings state
  const [emailSettingsLoading, setEmailSettingsLoading] = useState(false);
  const [reservationEmailEnabled, setReservationEmailEnabled] = useState(false);
  const [activeProvider, setActiveProvider] = useState<'resend' | 'gmail' | 'none'>('none');

  // Payment confirmation email templates
  const [paymentEmails, setPaymentEmails] = useState(initialEmailTemplates.payment);

  // Test email state
  const [testEmail, setTestEmail] = useState('');
  const [testEmailType, setTestEmailType] = useState<'reservation_confirmation' | 'payment_confirmation'>('payment_confirmation');
  const [testEmailLocale, setTestEmailLocale] = useState<'zh' | 'en'>('en');
  const [testEmailEventId, setTestEmailEventId] = useState<number | null>(events.length > 0 ? events[0].id : null);
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testEmailMessage, setTestEmailMessage] = useState('');

  // Email history state
  const [emailHistory, setEmailHistory] = useState<Array<{
    id: string;
    sentAt: string;
    recipientEmail: string;
    emailType: string;
    status: string;
    eventTitle: string | null;
    subject: string | null;
  }>>([]);
  const [emailHistoryLoading, setEmailHistoryLoading] = useState(false);
  const [emailHistoryTotal, setEmailHistoryTotal] = useState(0);
  const [emailHistoryOffset, setEmailHistoryOffset] = useState(0);
  const [emailHistoryLimit] = useState(50);
  const [emailHistoryTypeFilter, setEmailHistoryTypeFilter] = useState<'all' | 'reservation_confirmation' | 'payment_confirmation' | 'test'>('all');

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  const handleAction = async (action: () => Promise<void>) => {
    if (actionInFlight) return;
    setActionInFlight(true);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unexpected error.');
    } finally {
      setActionInFlight(false);
    }
  };

  // Load email settings on mount
  useEffect(() => {
    const loadEmailSettings = async () => {
      setEmailSettingsLoading(true);
      try {
        const response = await fetch('/api/admin/settings/email', {
          method: 'GET',
          credentials: 'include',
        });
        const data = await response.json();
        if (response.ok && data.ok) {
          setReservationEmailEnabled(data.settings.reservationConfirmationEnabled);
          setActiveProvider(data.settings.activeProvider);
        }
      } catch (error) {
        console.error('Failed to load email settings:', error);
      } finally {
        setEmailSettingsLoading(false);
      }
    };
    loadEmailSettings();
  }, []);

  const handleToggleReservationEmail = async () => {
    try {
      const newValue = !reservationEmailEnabled;
      const response = await fetch('/api/admin/settings/email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ reservationConfirmationEnabled: newValue }),
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        setReservationEmailEnabled(newValue);
        setMessage('Email settings updated successfully');
      } else {
        setError(data.error || 'Failed to update settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
  };

  // Load email history
  const loadEmailHistory = async () => {
    setEmailHistoryLoading(true);
    try {
      const typeParam = emailHistoryTypeFilter !== 'all' ? `&type=${emailHistoryTypeFilter}` : '';
      const response = await fetch(
        `/api/admin/email-history?limit=${emailHistoryLimit}&offset=${emailHistoryOffset}${typeParam}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );
      const data = await response.json();
      if (response.ok && data.ok) {
        setEmailHistory(data.emails);
        setEmailHistoryTotal(data.total);
      } else {
        console.error('Failed to load email history:', data.error);
      }
    } catch (error) {
      console.error('Failed to load email history:', error);
    } finally {
      setEmailHistoryLoading(false);
    }
  };

  const updateRegistrationEmailField = (locale: EmailLocale, field: 'subject' | 'body', value: string) => {
    setRegistrationEmails((current) => ({
      ...current,
      templates: {
        ...current.templates,
        [locale]: {
          ...current.templates[locale],
          [field]: value,
        },
      },
    }));
  };

  const saveRegistrationEmails = async () => {
    const response = await fetch('/api/admin/registration-email-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(registrationEmails),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({ error: 'Failed to save registration email settings' }));
      throw new Error(errorPayload.error || 'Failed to save registration email settings');
    }

    setMessage('Registration email settings saved');
  };

  const updatePaymentEmailField = (locale: EmailLocale, field: 'subject' | 'body', value: string) => {
    setPaymentEmails((current) => ({
      ...current,
      templates: {
        ...current.templates,
        [locale]: {
          ...current.templates[locale],
          [field]: value,
        },
      },
    }));
  };

  const savePaymentEmails = async () => {
    // TODO: Implement API endpoint for saving payment email templates
    setMessage('Payment email templates saved (stored locally for now)');
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      setTestEmailStatus('error');
      setTestEmailMessage('Invalid email format');
      return;
    }
    if (!testEmailEventId) {
      setTestEmailStatus('error');
      setTestEmailMessage('Please select an event');
      return;
    }
    setTestEmailStatus('sending');
    setTestEmailMessage('');
    try {
      const response = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          eventId: testEmailEventId,
          emailType: testEmailType,
          recipientEmail: testEmail,
          recipientLocale: testEmailLocale,
        }),
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        setTestEmailStatus('success');
        setTestEmailMessage(`Test email sent to ${testEmail}`);
        // Refresh email history after successful send
        await loadEmailHistory();
      } else {
        setTestEmailStatus('error');
        setTestEmailMessage(data.error || 'Failed to send test email');
      }
    } catch (err) {
      setTestEmailStatus('error');
      setTestEmailMessage(err instanceof Error ? err.message : 'Network error');
    }
  };

  return (
    <div aria-label="Email management" className="space-y-6">
      {/* Email Configuration Warning */}
      {activeProvider === 'none' && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <strong>⚠️ Email sending is not configured.</strong>
          <p className="mt-1">
            Configure either:
          </p>
          <ul className="mt-2 ml-4 list-disc space-y-1">
            <li><code className="rounded bg-black/20 px-1 py-0.5 font-mono text-xs">RESEND_API_KEY</code> + <code className="rounded bg-black/20 px-1 py-0.5 font-mono text-xs">REGISTRATION_EMAIL_FROM</code> (Resend provider), or</li>
            <li><code className="rounded bg-black/20 px-1 py-0.5 font-mono text-xs">GMAIL_USER</code> + <code className="rounded bg-black/20 px-1 py-0.5 font-mono text-xs">GMAIL_PASSWORD</code> (Gmail provider)</li>
          </ul>
        </div>
      )}
      {activeProvider !== 'none' && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <strong>✓ Email configured</strong> (using <strong>{activeProvider === 'resend' ? 'Resend' : 'Gmail'}</strong>)
        </div>
      )}

      {/* Message/Error notifications */}
      {message && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {/* Section 1: Email Settings */}
      <div className="rounded-[28px] border border-white/10 bg-white/10 p-6">
        <div className="rounded-[24px] border border-white/10 bg-black/10 p-5">
          <h2 className="text-xl font-semibold font-outfit">Email Settings</h2>
          <p className="mt-2 text-sm text-white/70">Control automated email notifications sent to users.</p>

          {emailSettingsLoading ? (
            <div className="mt-6 flex items-center justify-center py-4">
              <div className="text-white/60">Loading settings...</div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {/* Reservation Confirmation Toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="flex-1">
                  <h3 className="font-medium text-white">Reservation Confirmation Emails</h3>
                  <p className="mt-1 text-sm text-white/60">Automatically send confirmation email when users register for events</p>
                </div>
                <button
                  onClick={() => void handleAction(handleToggleReservationEmail)}
                  disabled={actionInFlight || activeProvider === 'none'}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-pink/40 disabled:opacity-50 ${
                    reservationEmailEnabled ? 'bg-brand-pink' : 'bg-white/20'
                  }`}
                  aria-label="Toggle reservation confirmation emails"
                  title={activeProvider === 'none' ? 'Email sending is not configured' : undefined}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      reservationEmailEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Payment Confirmation Info */}
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="flex-1">
                  <h3 className="font-medium text-white">Payment Confirmation Emails</h3>
                  <p className="mt-1 text-sm text-white/60">Always sent when admin confirms payment (cannot be disabled)</p>
                </div>
                <div className="text-sm font-medium text-white/60">Always On</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Registration Confirmation Email Templates */}
      <div className="rounded-[28px] border border-white/10 bg-white/10 p-6">
        <div className="rounded-[24px] border border-white/10 bg-black/10 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold font-outfit">Registration Confirmation Email Templates</h2>
              <p className="mt-2 max-w-3xl text-sm text-white/70">Customize the email sent immediately after successful registration.</p>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
              <input
                type="checkbox"
                checked={reservationEmailEnabled}
                onChange={(event) => setRegistrationEmails((currentSettings) => ({ ...currentSettings, enabled: event.target.checked }))}
              />
              <span className="text-sm text-white/85">Enable in templates</span>
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-brand-navy/60 p-4 text-sm text-white/70">
            Supported tokens: <span className="font-mono text-white">{'{{name}}'}</span>, <span className="font-mono text-white">{'{{email}}'}</span>,{' '}
            <span className="font-mono text-white">{'{{eventTitle}}'}</span>, <span className="font-mono text-white">{'{{paymentAmount}}'}</span>,{' '}
            <span className="font-mono text-white">{'{{paymentCurrency}}'}</span>, <span className="font-mono text-white">{'{{paymentInstructions}}'}</span>,{' '}
            <span className="font-mono text-white">{'{{siteUrl}}'}</span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {(['zh', 'en'] as EmailLocale[]).map((locale) => (
              <div key={locale} className="rounded-2xl border border-white/10 bg-black/10 p-5">
                <h3 className="text-lg font-semibold font-outfit">{locale === 'zh' ? 'Template (ZH)' : 'Template (EN)'}</h3>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm text-white/70">Subject</span>
                  <input
                    value={registrationEmails.templates[locale].subject}
                    onChange={(event) => updateRegistrationEmailField(locale, 'subject', event.target.value)}
                    className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40"
                  />
                </label>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm text-white/70">Body</span>
                  <textarea
                    rows={12}
                    value={registrationEmails.templates[locale].body}
                    onChange={(event) => updateRegistrationEmailField(locale, 'body', event.target.value)}
                    className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40"
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={() => void handleAction(saveRegistrationEmails)}
              disabled={actionInFlight}
              className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-3 font-semibold text-brand-navy transition hover:brightness-110 disabled:opacity-60"
            >
              {actionInFlight ? 'Saving…' : 'Save registration email templates'}
            </button>
          </div>
        </div>
      </div>

      {/* Section 3: Payment Confirmation Email Templates */}
      <div className="rounded-[28px] border border-white/10 bg-white/10 p-6">
        <div className="rounded-[24px] border border-white/10 bg-black/10 p-5">
          <div>
            <h2 className="text-xl font-semibold font-outfit">Payment Confirmation Email Templates</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/70">
              Customize the email sent when admin confirms payment. These emails are always sent (cannot be disabled).
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-brand-navy/60 p-4 text-sm text-white/70">
            Supported tokens: <span className="font-mono text-white">{'{{name}}'}</span>, <span className="font-mono text-white">{'{{email}}'}</span>,{' '}
            <span className="font-mono text-white">{'{{eventTitle}}'}</span>, <span className="font-mono text-white">{'{{eventDate}}'}</span>,{' '}
            <span className="font-mono text-white">{'{{eventLocation}}'}</span>,{' '}
            <span className="font-mono text-white">{'{{siteUrl}}'}</span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {(['zh', 'en'] as EmailLocale[]).map((locale) => (
              <div key={locale} className="rounded-2xl border border-white/10 bg-black/10 p-5">
                <h3 className="text-lg font-semibold font-outfit">{locale === 'zh' ? 'Template (ZH)' : 'Template (EN)'}</h3>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm text-white/70">Subject</span>
                  <input
                    value={paymentEmails.templates[locale].subject}
                    onChange={(event) => updatePaymentEmailField(locale, 'subject', event.target.value)}
                    className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40"
                  />
                </label>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm text-white/70">Body</span>
                  <textarea
                    rows={12}
                    value={paymentEmails.templates[locale].body}
                    onChange={(event) => updatePaymentEmailField(locale, 'body', event.target.value)}
                    className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40"
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={() => void handleAction(savePaymentEmails)}
              disabled={actionInFlight}
              className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-3 font-semibold text-brand-navy transition hover:brightness-110 disabled:opacity-60"
            >
              {actionInFlight ? 'Saving…' : 'Save payment email templates'}
            </button>
          </div>
        </div>
      </div>

      {/* Section 4: Test Email */}
      <div className="rounded-[28px] border border-white/10 bg-white/10 p-6">
        <div className="rounded-[24px] border border-white/10 bg-black/10 p-5">
          <h2 className="text-xl font-semibold font-outfit">Send Test Email</h2>
          <p className="mt-2 text-sm text-white/70">Send a test email to verify your email configuration is working correctly.</p>

          {activeProvider === 'none' ? (
            <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Test email feature is disabled. Please configure email provider (Resend or Gmail) to enable email sending.
            </div>
          ) : (
            <form onSubmit={handleSendTestEmail} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm text-white/70">Event</span>
                <select
                  value={testEmailEventId ?? ''}
                  onChange={(e) => setTestEmailEventId(Number(e.target.value))}
                  className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40"
                  disabled={testEmailStatus === 'sending' || events.length === 0}
                >
                  {events.length === 0 ? (
                    <option value="">No events available</option>
                  ) : (
                    events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.titleEn || event.title}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-white/70">Email Type</span>
                <select
                  value={testEmailType}
                  onChange={(e) => setTestEmailType(e.target.value as 'reservation_confirmation' | 'payment_confirmation')}
                  className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40"
                  disabled={testEmailStatus === 'sending'}
                >
                  <option value="payment_confirmation">Payment Confirmation</option>
                  <option value="reservation_confirmation">Reservation Confirmation</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-white/70">Locale</span>
                <select
                  value={testEmailLocale}
                  onChange={(e) => setTestEmailLocale(e.target.value as 'zh' | 'en')}
                  className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40"
                  disabled={testEmailStatus === 'sending'}
                >
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-white/70">Recipient Email</span>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40"
                  disabled={testEmailStatus === 'sending'}
                />
              </label>

              <button
                type="submit"
                disabled={testEmailStatus === 'sending' || !testEmailEventId}
                className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-3 font-semibold text-brand-navy transition hover:brightness-110 disabled:opacity-60"
              >
                {testEmailStatus === 'sending' ? 'Sending…' : 'Send Test Email'}
              </button>

              {testEmailMessage && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    testEmailStatus === 'success'
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                      : testEmailStatus === 'error'
                        ? 'border-red-400/30 bg-red-500/10 text-red-100'
                        : 'border-blue-400/30 bg-blue-500/10 text-blue-100'
                  }`}
                >
                  {testEmailMessage}
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Section 5: Email History */}
      <div className="rounded-[28px] border border-white/10 bg-white/10 p-6">
        <div className="rounded-[24px] border border-white/10 bg-black/10 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold font-outfit">Email History</h2>
              <p className="mt-2 text-sm text-white/70">View all emails sent by the system with delivery status.</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={emailHistoryTypeFilter}
                onChange={async (e) => {
                  const newType = e.target.value as typeof emailHistoryTypeFilter;
                  setEmailHistoryTypeFilter(newType);
                  setEmailHistoryOffset(0);
                  // Load with the new filter immediately
                  setEmailHistoryLoading(true);
                  try {
                    const typeParam = newType !== 'all' ? `&type=${newType}` : '';
                    const response = await fetch(
                      `/api/admin/email-history?limit=${emailHistoryLimit}&offset=0${typeParam}`,
                      {
                        method: 'GET',
                        credentials: 'include',
                      }
                    );
                    const data = await response.json();
                    if (response.ok && data.ok) {
                      setEmailHistory(data.emails);
                      setEmailHistoryTotal(data.total);
                    }
                  } catch (error) {
                    console.error('Failed to load email history:', error);
                  } finally {
                    setEmailHistoryLoading(false);
                  }
                }}
                className="rounded-2xl bg-black/20 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-pink/40"
                disabled={emailHistoryLoading}
              >
                <option value="all">All Types</option>
                <option value="reservation_confirmation">Reservation Confirmation</option>
                <option value="payment_confirmation">Payment Confirmation</option>
                <option value="test">Test</option>
              </select>
              <button
                onClick={() => void loadEmailHistory()}
                disabled={emailHistoryLoading}
                className="inline-flex min-h-10 items-center rounded-full bg-brand-pink px-5 py-2 text-sm font-semibold text-brand-navy transition hover:brightness-110 disabled:opacity-60"
              >
                {emailHistoryLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="mt-6">
            {emailHistoryLoading && emailHistory.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-white/60">Loading email history...</div>
              </div>
            ) : emailHistory.length === 0 ? (
              <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-black/10 py-12">
                <div className="text-center text-white/60">
                  <p>No emails found</p>
                  <p className="mt-1 text-sm">Try adjusting the filter or send a test email</p>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/10 bg-black/20">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-white/70">Sent At</th>
                        <th className="px-4 py-3 text-left font-medium text-white/70">Recipient</th>
                        <th className="px-4 py-3 text-left font-medium text-white/70">Type</th>
                        <th className="px-4 py-3 text-left font-medium text-white/70">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-white/70">Event</th>
                        <th className="px-4 py-3 text-left font-medium text-white/70">Subject</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {emailHistory.map((email) => (
                        <tr key={email.id} className="hover:bg-white/5">
                          <td className="px-4 py-3 text-white/90">
                            {new Date(email.sentAt).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3 text-white/90">{email.recipientEmail}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white/80">
                              {email.emailType === 'reservation_confirmation'
                                ? 'Reservation'
                                : email.emailType === 'payment_confirmation'
                                  ? 'Payment'
                                  : 'Test'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                email.status === 'sent'
                                  ? 'bg-emerald-500/20 text-emerald-100'
                                  : email.status === 'failed'
                                    ? 'bg-red-500/20 text-red-100'
                                    : 'bg-white/10 text-white/60'
                              }`}
                            >
                              {email.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white/70">{email.eventTitle || '—'}</td>
                          <td className="px-4 py-3 text-white/70">{email.subject || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="mt-6 flex items-center justify-between text-sm">
                  <div className="text-white/60">
                    Showing {emailHistoryOffset + 1} - {Math.min(emailHistoryOffset + emailHistoryLimit, emailHistoryTotal)} of{' '}
                    {emailHistoryTotal} emails
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const newOffset = Math.max(0, emailHistoryOffset - emailHistoryLimit);
                        setEmailHistoryOffset(newOffset);
                        setEmailHistoryLoading(true);
                        try {
                          const typeParam = emailHistoryTypeFilter !== 'all' ? `&type=${emailHistoryTypeFilter}` : '';
                          const response = await fetch(
                            `/api/admin/email-history?limit=${emailHistoryLimit}&offset=${newOffset}${typeParam}`,
                            {
                              method: 'GET',
                              credentials: 'include',
                            }
                          );
                          const data = await response.json();
                          if (response.ok && data.ok) {
                            setEmailHistory(data.emails);
                            setEmailHistoryTotal(data.total);
                          }
                        } catch (error) {
                          console.error('Failed to load email history:', error);
                        } finally {
                          setEmailHistoryLoading(false);
                        }
                      }}
                      disabled={emailHistoryLoading || emailHistoryOffset === 0}
                      className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/20 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={async () => {
                        const newOffset = emailHistoryOffset + emailHistoryLimit;
                        setEmailHistoryOffset(newOffset);
                        setEmailHistoryLoading(true);
                        try {
                          const typeParam = emailHistoryTypeFilter !== 'all' ? `&type=${emailHistoryTypeFilter}` : '';
                          const response = await fetch(
                            `/api/admin/email-history?limit=${emailHistoryLimit}&offset=${newOffset}${typeParam}`,
                            {
                              method: 'GET',
                              credentials: 'include',
                            }
                          );
                          const data = await response.json();
                          if (response.ok && data.ok) {
                            setEmailHistory(data.emails);
                            setEmailHistoryTotal(data.total);
                          }
                        } catch (error) {
                          console.error('Failed to load email history:', error);
                        } finally {
                          setEmailHistoryLoading(false);
                        }
                      }}
                      disabled={emailHistoryLoading || emailHistoryOffset + emailHistoryLimit >= emailHistoryTotal}
                      className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/20 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
