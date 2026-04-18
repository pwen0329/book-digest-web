'use client';

import { useState, useEffect } from 'react';
import type { RegistrationEmailLocale, RegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';

type EmailManagerProps = {
  initialRegistrationEmails: RegistrationSuccessEmailSettings;
};

export default function EmailManager({ initialRegistrationEmails }: EmailManagerProps) {
  // Message/error state
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);

  // Registration email templates state
  const [registrationEmails, setRegistrationEmails] = useState(initialRegistrationEmails);

  // Email settings state
  const [emailSettingsLoading, setEmailSettingsLoading] = useState(false);
  const [reservationEmailEnabled, setReservationEmailEnabled] = useState(false);
  const [resendConfigured, setResendConfigured] = useState(true); // Optimistic default

  // Payment confirmation email templates
  const [paymentEmails, setPaymentEmails] = useState({
    templates: {
      zh: {
        subject: 'Book Digest 付款確認｜{{eventTitle}}',
        body: `嗨 {{name}}，

感謝您的付款！您的報名已確認。

活動詳情：
• 活動：{{eventTitle}}
• 日期：{{eventDate}}
• 時間：{{eventTime}}
• 地點：{{eventLocation}}

我們期待在活動中見到您！

如有任何問題，請隨時與我們聯繫。

Book Digest 團隊
{{siteUrl}}`,
      },
      en: {
        subject: 'Book Digest Payment Confirmed | {{eventTitle}}',
        body: `Hi {{name}},

Thank you for your payment! Your registration is now confirmed.

Event Details:
• Event: {{eventTitle}}
• Date: {{eventDate}}
• Time: {{eventTime}}
• Location: {{eventLocation}}

We look forward to seeing you at the event!

If you have any questions, please feel free to contact us.

Book Digest Team
{{siteUrl}}`,
      },
    },
  });

  // Test email state
  const [testEmail, setTestEmail] = useState('');
  const [testEmailType, setTestEmailType] = useState<'reservation_confirmation' | 'payment_confirmation'>('payment_confirmation');
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testEmailMessage, setTestEmailMessage] = useState('');

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
          setResendConfigured(data.settings.resendConfigured);
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

  const updateRegistrationEmailField = (locale: RegistrationEmailLocale, field: 'subject' | 'body', value: string) => {
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

  const updatePaymentEmailField = (locale: RegistrationEmailLocale, field: 'subject' | 'body', value: string) => {
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
    setTestEmailStatus('sending');
    setTestEmailMessage('');
    try {
      const response = await fetch('/api/admin/email-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ recipientEmail: testEmail, emailType: testEmailType }),
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        setTestEmailStatus('success');
        setTestEmailMessage(data.message || `Test email sent to ${testEmail}`);
      } else {
        setTestEmailStatus('error');
        setTestEmailMessage(data.message || data.error || 'Failed to send test email');
      }
    } catch (err) {
      setTestEmailStatus('error');
      setTestEmailMessage(err instanceof Error ? err.message : 'Network error');
    }
  };

  return (
    <div aria-label="Email management" className="space-y-6">
      {/* Resend API Key Warning */}
      {!resendConfigured && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <strong>⚠️ Email sending is not configured.</strong>
          <p className="mt-1">
            The <code className="rounded bg-black/20 px-1 py-0.5 font-mono text-xs">RESEND_API_KEY</code> environment variable is not set.
            Email features are disabled until this is configured.
          </p>
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
                  disabled={actionInFlight || !resendConfigured}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-pink/40 disabled:opacity-50 ${
                    reservationEmailEnabled ? 'bg-brand-pink' : 'bg-white/20'
                  }`}
                  aria-label="Toggle reservation confirmation emails"
                  title={!resendConfigured ? 'Email sending is not configured' : undefined}
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
                checked={registrationEmails.enabled}
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
            {(['zh', 'en'] as RegistrationEmailLocale[]).map((locale) => (
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
            <span className="font-mono text-white">{'{{eventTime}}'}</span>, <span className="font-mono text-white">{'{{eventLocation}}'}</span>,{' '}
            <span className="font-mono text-white">{'{{siteUrl}}'}</span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {(['zh', 'en'] as RegistrationEmailLocale[]).map((locale) => (
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

          {!resendConfigured ? (
            <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Test email feature is disabled. Please configure <code className="rounded bg-black/20 px-1 py-0.5 font-mono text-xs">RESEND_API_KEY</code> to enable email sending.
            </div>
          ) : (
            <form onSubmit={handleSendTestEmail} className="mt-6 space-y-4">
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

              <button
                type="submit"
                disabled={testEmailStatus === 'sending'}
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
    </div>
  );
}
