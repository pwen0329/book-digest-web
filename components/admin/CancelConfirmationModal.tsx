'use client';

import { useState } from 'react';
import type { RegistrationRecord } from '@/lib/registration-store';
import type { Event } from '@/types/event';

type CancelConfirmationModalProps = {
  registration: RegistrationRecord;
  event: Event;
  emailConfig: { replyTo: string; siteUrl: string };
  onClose: () => void;
  onConfirm: (emailContent: string | null, emailSubject: string | null) => Promise<void>;
};

const EMAIL_TEMPLATES = {
  en: `Dear {{name}},

We regret to inform you that your registration for {{eventTitle}} has been cancelled.

Event Details:
- Title: {{eventTitle}}
- Date: {{eventDate}}
- Location: {{venueName}}

If you have any questions, please feel free to contact us at {{replyTo}}.`,
  zh: `親愛的 {{name}}，

很遺憾通知您，您的活動報名已被取消。

活動資訊：
- 活動名稱：{{eventTitle}}
- 活動日期：{{eventDate}}
- 地點：{{venueName}}

如有任何問題，請聯繫我們：{{replyTo}}`,
};

const EMAIL_SUBJECTS = {
  en: 'Registration Cancelled - Book Digest',
  zh: '活動報名取消通知 - 吃書反芻',
};

export default function CancelConfirmationModal({
  registration,
  event,
  emailConfig,
  onClose,
  onConfirm,
}: CancelConfirmationModalProps) {
  const [locale, setLocale] = useState<'en' | 'zh'>(registration.locale === 'zh' ? 'zh' : 'en');
  const [sendEmail, setSendEmail] = useState(true);
  const [emailContent, setEmailContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize email content and subject with interpolated template
  useState(() => {
    const template = EMAIL_TEMPLATES[locale];
    const interpolated = template
      .replace(/{{name}}/g, registration.name)
      .replace(/{{eventTitle}}/g, locale === 'zh' ? event.title : (event.titleEn || event.title))
      .replace(/{{eventDate}}/g, new Date(event.eventDate).toLocaleString(locale === 'zh' ? 'zh-TW' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }))
      .replace(/{{venueName}}/g, event.venueName || 'N/A')
      .replace(/{{replyTo}}/g, emailConfig.replyTo)
      .replace(/{{siteUrl}}/g, emailConfig.siteUrl);
    setEmailContent(interpolated);
    setEmailSubject(EMAIL_SUBJECTS[locale]);
  });

  const handleLocaleChange = (newLocale: 'en' | 'zh') => {
    setLocale(newLocale);
    const template = EMAIL_TEMPLATES[newLocale];
    const interpolated = template
      .replace(/{{name}}/g, registration.name)
      .replace(/{{eventTitle}}/g, newLocale === 'zh' ? event.title : (event.titleEn || event.title))
      .replace(/{{eventDate}}/g, new Date(event.eventDate).toLocaleString(newLocale === 'zh' ? 'zh-TW' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }))
      .replace(/{{venueName}}/g, event.venueName || 'N/A')
      .replace(/{{replyTo}}/g, emailConfig.replyTo)
      .replace(/{{siteUrl}}/g, emailConfig.siteUrl);
    setEmailContent(interpolated);
    setEmailSubject(EMAIL_SUBJECTS[newLocale]);
  };

  const handleConfirm = async () => {
    setCancelling(true);
    setError(null);
    try {
      await onConfirm(
        sendEmail ? emailContent : null,
        sendEmail ? emailSubject : null
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel registration');
    } finally {
      setCancelling(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
    >
      <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-brand-navy p-6">
        <h2 id="cancel-modal-title" className="text-2xl font-semibold font-outfit text-white">
          Cancel Registration
        </h2>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <p className="mt-4 text-white/70">
          Are you sure you want to cancel the registration for <span className="font-semibold text-white">{registration.name}</span>?
        </p>

        {/* Send Email Toggle */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-5 w-5 rounded border-white/20 bg-black/20 text-brand-pink focus:ring-2 focus:ring-brand-pink/40"
            />
            <span className="text-white font-medium">Send cancellation email to user</span>
          </label>
        </div>

        {/* Email Template Editor */}
        {sendEmail && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold font-outfit text-white">Email Template</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleLocaleChange('en')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                    locale === 'en'
                      ? 'bg-brand-pink text-brand-navy'
                      : 'bg-white/10 text-white/70 hover:bg-white/15'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => handleLocaleChange('zh')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                    locale === 'zh'
                      ? 'bg-brand-pink text-brand-navy'
                      : 'bg-white/10 text-white/70 hover:bg-white/15'
                  }`}
                >
                  中文
                </button>
              </div>
            </div>
            <textarea
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              rows={12}
              className="w-full rounded-2xl bg-black/20 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-brand-pink/40 font-mono text-sm"
              placeholder="Email content..."
            />
            <p className="mt-2 text-xs text-white/50">
              You can edit the email content above before sending.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={cancelling}
            className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={cancelling}
            className="inline-flex min-h-11 items-center rounded-full bg-red-500 px-6 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}
