'use client';

import { useState, useEffect } from 'react';
import type { RegistrationRecord } from '@/lib/registration-store';
import type { Event } from '@/types/event';

type ModalState = 'editing' | 'sending' | 'results';

type SendResult = {
  registrationId: string;
  success: boolean;
  email: string;
  name: string;
  error?: string;
};

type SendSummary = {
  total: number;
  successful: number;
  failed: number;
};

interface FinalConfirmationModalProps {
  registrations: RegistrationRecord[];
  event: Event;
  onClose: () => void;
  onSuccess: () => void;
}

// SessionStorage keys
const STORAGE_KEY_SUBJECT_ZH = 'admin_final_confirmation_subject_zh';
const STORAGE_KEY_SUBJECT_EN = 'admin_final_confirmation_subject_en';
const STORAGE_KEY_TEMPLATE_ZH = 'admin_final_confirmation_template_zh';
const STORAGE_KEY_TEMPLATE_EN = 'admin_final_confirmation_template_en';

// Default templates (client-safe, no server-only imports)
const DEFAULT_TEMPLATES = {
  zh: {
    subject: 'Book Digest 活動最終確認｜{{eventTitle}}',
    body: `嗨 {{name}}，

您報名的 Book Digest 活動即將舉行！

活動詳情：
• 活動：{{eventTitle}}
• 日期：{{eventDate}}
• 地點：{{eventLocation}}

請準時參加，我們期待在活動中見到您！

如有任何問題，請隨時與我們聯繫：bookdigest2020@gmail.com`,
  },
  en: {
    subject: 'Book Digest Event Final Confirmation | {{eventTitle}}',
    body: `Hi {{name}},

Your Book Digest event is coming up soon!

Event Details:
• Event: {{eventTitle}}
• Date: {{eventDate}}
• Location: {{eventLocation}}

Please arrive on time. We look forward to seeing you at the event!

If you have any questions, please feel free to contact us at bookdigest2020@gmail.com`,
  },
};

export default function FinalConfirmationModal({
  registrations,
  event,
  onClose,
  onSuccess,
}: FinalConfirmationModalProps) {
  const [modalState, setModalState] = useState<ModalState>('editing');
  // Initialize with defaults, then override from sessionStorage in useEffect
  const [subjectZh, setSubjectZh] = useState(DEFAULT_TEMPLATES.zh.subject);
  const [subjectEn, setSubjectEn] = useState(DEFAULT_TEMPLATES.en.subject);
  const [templateZh, setTemplateZh] = useState(DEFAULT_TEMPLATES.zh.body);
  const [templateEn, setTemplateEn] = useState(DEFAULT_TEMPLATES.en.body);
  const [results, setResults] = useState<SendResult[]>([]);
  const [summary, setSummary] = useState<SendSummary | null>(null);

  // Load saved templates from sessionStorage if available
  useEffect(() => {
    try {
      const savedSubjectZh = sessionStorage.getItem(STORAGE_KEY_SUBJECT_ZH);
      const savedSubjectEn = sessionStorage.getItem(STORAGE_KEY_SUBJECT_EN);
      const savedTemplateZh = sessionStorage.getItem(STORAGE_KEY_TEMPLATE_ZH);
      const savedTemplateEn = sessionStorage.getItem(STORAGE_KEY_TEMPLATE_EN);

      if (savedSubjectZh) setSubjectZh(savedSubjectZh);
      if (savedSubjectEn) setSubjectEn(savedSubjectEn);
      if (savedTemplateZh) setTemplateZh(savedTemplateZh);
      if (savedTemplateEn) setTemplateEn(savedTemplateEn);
    } catch (error) {
      console.error('Failed to load templates from sessionStorage:', error);
    }
  }, []);

  // Auto-save to sessionStorage
  const updateSubjectZh = (value: string) => {
    setSubjectZh(value);
    try {
      sessionStorage.setItem(STORAGE_KEY_SUBJECT_ZH, value);
    } catch (error) {
      console.error('Failed to save subject (ZH) to sessionStorage:', error);
    }
  };

  const updateSubjectEn = (value: string) => {
    setSubjectEn(value);
    try {
      sessionStorage.setItem(STORAGE_KEY_SUBJECT_EN, value);
    } catch (error) {
      console.error('Failed to save subject (EN) to sessionStorage:', error);
    }
  };

  const updateTemplateZh = (value: string) => {
    setTemplateZh(value);
    try {
      sessionStorage.setItem(STORAGE_KEY_TEMPLATE_ZH, value);
    } catch (error) {
      console.error('Failed to save template (ZH) to sessionStorage:', error);
    }
  };

  const updateTemplateEn = (value: string) => {
    setTemplateEn(value);
    try {
      sessionStorage.setItem(STORAGE_KEY_TEMPLATE_EN, value);
    } catch (error) {
      console.error('Failed to save template (EN) to sessionStorage:', error);
    }
  };

  // Send emails
  const handleSend = async () => {
    setModalState('sending');

    try {
      const response = await fetch('/api/admin/send-final-confirmation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationIds: registrations.map(r => r.id),
          subjectZh,
          subjectEn,
          templateZh,
          templateEn,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send emails');
      }

      // Show results
      setResults(data.results);
      setSummary(data.summary);
      setModalState('results');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to send emails');
      setModalState('editing'); // Back to editing on error
    }
  };

  // Close and refresh
  const handleClose = () => {
    if (modalState === 'results') {
      onSuccess(); // Refresh registrations list
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-white/10 bg-gradient-to-br from-gray-900 to-gray-800 p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold font-outfit">
            {modalState === 'results'
              ? 'Send Results'
              : `Send Final Confirmation (${registrations.length} recipients)`
            }
          </h2>
        </div>

        {/* Editing State */}
        {modalState === 'editing' && (
          <>
            {/* Event Info */}
            <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/70">
                <strong>Event:</strong> {event.title}
              </p>
              <div className="mt-3">
                <p className="text-sm text-white/70 mb-1">
                  <strong>Recipients:</strong>
                </p>
                <div className="rounded-lg bg-black/20 p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs text-white/60 font-mono break-all">
                    {registrations
                      .map((r) => r.email)
                      .sort()
                      .join(', ')}
                  </p>
                </div>
              </div>
            </div>

            {/* Chinese Template */}
            <div className="mb-6">
              <h3 className="mb-3 text-lg font-semibold text-white/90">Chinese Email Template</h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm text-white/70">Subject (ZH)</label>
                  <input
                    type="text"
                    value={subjectZh}
                    onChange={(e) => updateSubjectZh(e.target.value)}
                    className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-white/70">Body (ZH)</label>
                  <textarea
                    value={templateZh}
                    onChange={(e) => updateTemplateZh(e.target.value)}
                    rows={10}
                    className="w-full rounded-2xl bg-black/20 px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-brand-pink/40"
                  />
                </div>
              </div>
            </div>

            {/* English Template */}
            <div className="mb-6">
              <h3 className="mb-3 text-lg font-semibold text-white/90">English Email Template</h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm text-white/70">Subject (EN)</label>
                  <input
                    type="text"
                    value={subjectEn}
                    onChange={(e) => updateSubjectEn(e.target.value)}
                    className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-white/70">Body (EN)</label>
                  <textarea
                    value={templateEn}
                    onChange={(e) => updateTemplateEn(e.target.value)}
                    rows={10}
                    className="w-full rounded-2xl bg-black/20 px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-brand-pink/40"
                  />
                </div>
              </div>
            </div>

            {/* Help Text */}
            <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-sm text-blue-200">
                <strong>Available variables:</strong>{' '}
                <code className="rounded bg-black/30 px-2 py-0.5 font-mono text-xs">{'{{name}}'}</code>,{' '}
                <code className="rounded bg-black/30 px-2 py-0.5 font-mono text-xs">{'{{eventTitle}}'}</code>,{' '}
                <code className="rounded bg-black/30 px-2 py-0.5 font-mono text-xs">{'{{eventDate}}'}</code>,{' '}
                <code className="rounded bg-black/30 px-2 py-0.5 font-mono text-xs">{'{{eventLocation}}'}</code>,{' '}
                <code className="rounded bg-black/30 px-2 py-0.5 font-mono text-xs">{'{{siteUrl}}'}</code>
              </p>
            </div>
          </>
        )}

        {/* Sending State */}
        {modalState === 'sending' && (
          <div className="flex flex-col items-center justify-center py-12">
            <svg className="h-12 w-12 animate-spin text-brand-pink" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-white/70">Sending emails... Please wait.</p>
          </div>
        )}

        {/* Results State */}
        {modalState === 'results' && summary && (
          <>
            {/* Summary */}
            <div className={`mb-6 rounded-2xl border p-4 ${
              summary.failed === 0
                ? 'border-green-500/20 bg-green-500/10'
                : 'border-yellow-500/20 bg-yellow-500/10'
            }`}>
              <p className="text-lg text-white">
                Successfully sent <strong>{summary.successful}</strong> of <strong>{summary.total}</strong> emails
              </p>
              {summary.failed > 0 && (
                <p className="mt-2 text-red-400">
                  {summary.failed} email(s) failed to send
                </p>
              )}
            </div>

            {/* Results Table */}
            <div className="mb-6">
              <h3 className="mb-3 text-lg font-semibold text-white/90">Detailed Results</h3>
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-white/5 text-left text-white/60">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-black/10">
                      {results.map((result) => (
                        <tr key={result.registrationId}>
                          <td className="px-4 py-3 text-white">{result.name}</td>
                          <td className="px-4 py-3 text-white/85">{result.email}</td>
                          <td className="px-4 py-3">
                            {result.success ? (
                              <span className="rounded-full bg-green-500/20 px-2.5 py-1 text-xs uppercase tracking-wide text-green-300">
                                Sent
                              </span>
                            ) : (
                              <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs uppercase tracking-wide text-red-300">
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-white/75">{result.error || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3">
          {modalState === 'editing' && (
            <>
              <button
                onClick={onClose}
                className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-6 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!subjectZh || !subjectEn || !templateZh || !templateEn}
                className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-2 text-sm font-semibold text-white shadow-[0_3px_0_0_rgba(0,0,0,0.3),0_4px_8px_-2px_rgba(0,0,0,0.2)] transition-all hover:shadow-[0_1px_0_0_rgba(0,0,0,0.3),0_2px_6px_-2px_rgba(0,0,0,0.2)] hover:translate-y-[2px] active:shadow-[0_0_0_0_rgba(0,0,0,0.3)] active:translate-y-[3px] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                Send to {registrations.length} recipients
              </button>
            </>
          )}

          {modalState === 'sending' && (
            <button
              disabled
              className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-6 py-2 text-sm font-medium text-white/50"
            >
              Sending...
            </button>
          )}

          {modalState === 'results' && (
            <button
              onClick={handleClose}
              className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-2 text-sm font-semibold text-white shadow-[0_3px_0_0_rgba(0,0,0,0.3),0_4px_8px_-2px_rgba(0,0,0,0.2)] transition-all hover:shadow-[0_1px_0_0_rgba(0,0,0,0.3),0_2px_6px_-2px_rgba(0,0,0,0.2)] hover:translate-y-[2px] active:shadow-[0_0_0_0_rgba(0,0,0,0.3)] active:translate-y-[3px]"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
