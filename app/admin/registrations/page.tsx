'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RegistrationAuditSummary, RegistrationRecord, RegistrationRecordStatus } from '@/lib/registration-store';
import type { Event } from '@/types/event';
import PaymentReviewModal from '@/components/admin/RegistrationReviewModal';

type RegistrationsResponse = {
  items: RegistrationRecord[];
  summary: RegistrationAuditSummary;
};

function toIsoString(value: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [registrationsSummary, setRegistrationsSummary] = useState<RegistrationAuditSummary | null>(null);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationEventFilter, setRegistrationEventFilter] = useState<'ALL' | number>('ALL');
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState<'ALL' | RegistrationRecordStatus>('ALL');
  const [registrationSearch, setRegistrationSearch] = useState('');
  const [registrationCreatedAfter, setRegistrationCreatedAfter] = useState('');
  const [registrationCreatedBefore, setRegistrationCreatedBefore] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [reviewingRegistration, setReviewingRegistration] = useState<RegistrationRecord | null>(null);
  const [emailConfig, setEmailConfig] = useState<{ replyTo: string; siteUrl: string }>({ replyTo: '', siteUrl: '' });

  const refreshRegistrations = useCallback(async () => {
    setRegistrationsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (registrationEventFilter !== 'ALL') {
        params.set('eventId', String(registrationEventFilter));
      }
      if (registrationStatusFilter !== 'ALL') {
        params.set('status', registrationStatusFilter);
      }
      if (registrationSearch.trim()) {
        params.set('search', registrationSearch.trim());
      }
      if (registrationCreatedAfter) {
        params.set('createdAfter', toIsoString(registrationCreatedAfter));
      }
      if (registrationCreatedBefore) {
        params.set('createdBefore', toIsoString(registrationCreatedBefore));
      }

      const response = await fetch(`/api/admin/registrations?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => null) as RegistrationsResponse | null;
      if (!response.ok || !payload) {
        throw new Error(payload && 'error' in payload ? String((payload as { error?: unknown }).error) : 'Unable to load registrations.');
      }

      const items = payload.items || [];
      setRegistrations(items);

      // Calculate summary from filtered results
      const filteredSummary: RegistrationAuditSummary = {
        total: items.length,
        byStatus: {
          pending: items.filter(r => r.status === 'pending').length,
          confirmed: items.filter(r => r.status === 'confirmed').length,
          cancelled: items.filter(r => r.status === 'cancelled').length,
        },
        byVenueLocation: payload.summary?.byVenueLocation || {} as RegistrationAuditSummary['byVenueLocation'],
      };
      setRegistrationsSummary(filteredSummary);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load registrations.');
    } finally {
      setRegistrationsLoading(false);
    }
  }, [registrationCreatedAfter, registrationCreatedBefore, registrationEventFilter, registrationSearch, registrationStatusFilter]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [eventsRes, emailConfigRes] = await Promise.all([
          fetch('/api/admin/events-v2', { credentials: 'include' }),
          fetch('/api/email-config'),
        ]);

        const eventsData = await eventsRes.json();
        if (eventsRes.ok && eventsData.events) {
          setEvents(eventsData.events);
        }

        const emailConfigData = await emailConfigRes.json();
        if (emailConfigRes.ok) {
          setEmailConfig(emailConfigData);
        }

        // Load registrations on initial mount
        await refreshRegistrations();
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    void loadData();
  }, []);

  async function downloadRegistrationsCsv() {
    const params = new URLSearchParams({ limit: '1000', format: 'csv' });
    if (registrationEventFilter !== 'ALL') {
      params.set('eventId', String(registrationEventFilter));
    }
    if (registrationStatusFilter !== 'ALL') {
      params.set('status', registrationStatusFilter);
    }
    if (registrationSearch.trim()) {
      params.set('search', registrationSearch.trim());
    }
    if (registrationCreatedAfter) {
      params.set('createdAfter', toIsoString(registrationCreatedAfter));
    }
    if (registrationCreatedBefore) {
      params.set('createdBefore', toIsoString(registrationCreatedBefore));
    }

    const response = await fetch(`/api/admin/registrations?${params.toString()}`, {
      cache: 'no-store',
      credentials: 'include',
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: 'Unable to export CSV.' }));
      throw new Error(payload.error || 'Unable to export CSV.');
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  async function handleAction(action: () => Promise<void>) {
    if (actionInFlight) {
      return;
    }

    setActionInFlight(true);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unexpected error.');
    } finally {
      setActionInFlight(false);
    }
  }

  async function handleConfirmPayment(registrationId: string) {
    const response = await fetch(`/api/admin/registrations/${registrationId}/confirm-payment`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Failed to confirm payment' }));
      throw new Error(data.error || 'Failed to confirm payment');
    }

    // Refresh the registration list after confirmation
    await refreshRegistrations();
  }

  async function handleCancelRegistration(registrationId: string, emailContent: string | null, emailSubject: string | null = null) {
    const response = await fetch(`/api/admin/registrations/${registrationId}/cancel`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emailContent, emailSubject }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Failed to cancel registration' }));
      throw new Error(data.error || 'Failed to cancel registration');
    }

    // Refresh the registration list after cancellation
    await refreshRegistrations();
  }

  return (
    <>
      {error ? <div className="rounded-[28px] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <div aria-label="Registrations viewer" className="rounded-[28px] border border-white/10 bg-white/10 p-6">
        <div className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-black/10 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold font-outfit">Registrations audit</h2>
              <p className="mt-2 max-w-3xl text-sm text-white/70">
                This viewer reads from the app registration store used for capacity and confirmation flow. It supports CSV export, time-window filtering, and a per-row lifecycle trail including request id, mirror states, and delivery attempts.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void handleAction(downloadRegistrationsCsv)} disabled={registrationsLoading || actionInFlight} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-60">
                Export CSV
              </button>
              <button type="button" onClick={() => void refreshRegistrations()} disabled={registrationsLoading} className="inline-flex min-h-11 w-[100px] items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-60">
                {registrationsLoading ? (
                  <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : 'Search'}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <label className="block">
              <span className="mb-2 block text-sm text-white/70">Event</span>
              <select value={registrationEventFilter} onChange={(event) => setRegistrationEventFilter(event.target.value === 'ALL' ? 'ALL' : parseInt(event.target.value, 10))} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40">
                <option value="ALL">All events</option>
                {events.slice().sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()).map((event) => {
                  const eventDate = new Date(event.eventDate);
                  const isComplete = eventDate < new Date();
                  const dateStr = eventDate.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
                  return (
                    <option key={event.id} value={event.id} style={{ color: isComplete ? '#888' : undefined }}>
                      {dateStr} {event.title}{isComplete ? ' (complete)' : ''}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-white/70">Status</span>
              <select value={registrationStatusFilter} onChange={(event) => setRegistrationStatusFilter(event.target.value as 'ALL' | RegistrationRecordStatus)} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40">
                <option value="ALL">All statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-white/70">Search</span>
              <input value={registrationSearch} onChange={(event) => setRegistrationSearch(event.target.value)} placeholder="Name, email, profession" className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-white/70">Submitted after</span>
              <input type="datetime-local" value={registrationCreatedAfter} onChange={(event) => setRegistrationCreatedAfter(event.target.value)} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-white/70">Submitted before</span>
              <input type="datetime-local" value={registrationCreatedBefore} onChange={(event) => setRegistrationCreatedBefore(event.target.value)} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
            </label>
          </div>

          {registrationsSummary ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Total</p><p className="mt-1 text-2xl font-semibold">{registrationsSummary.total}</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Confirmed</p><p className="mt-1 text-2xl font-semibold">{registrationsSummary.byStatus.confirmed}</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Pending</p><p className="mt-1 text-2xl font-semibold">{registrationsSummary.byStatus.pending}</p></div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/5 text-left text-white/60">
                  <tr>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Profession</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-black/10">
                  {registrations.map((registration) => (
                    <tr key={registration.id}>
                      <td className="px-4 py-3 text-white/75">{new Date(registration.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-white">{events.find((e) => e.id === registration.eventId)?.title || `Event #${registration.eventId}`}</td>
                      <td className="px-4 py-3 text-white">{registration.name}</td>
                      <td className="px-4 py-3 text-white/85">{registration.email}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs uppercase tracking-wide text-white">
                          {registration.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/75">{registration.profession}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setReviewingRegistration(registration)}
                          className="inline-flex items-center rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-[0_3px_0_0_rgba(0,0,0,0.3),0_4px_8px_-2px_rgba(0,0,0,0.2)] transition-all hover:shadow-[0_1px_0_0_rgba(0,0,0,0.3),0_2px_6px_-2px_rgba(0,0,0,0.2)] hover:translate-y-[2px] active:shadow-[0_0_0_0_rgba(0,0,0,0.3)] active:translate-y-[3px]"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!registrations.length ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-white/60">No registrations matched the current filters.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Review Modal */}
      {reviewingRegistration && (
        <PaymentReviewModal
          registration={reviewingRegistration}
          event={events.find(e => e.id === reviewingRegistration.eventId)}
          emailConfig={emailConfig}
          onClose={() => setReviewingRegistration(null)}
          onConfirm={async () => {
            await handleConfirmPayment(reviewingRegistration.id);
            setReviewingRegistration(null);
          }}
          onCancel={async (emailContent, emailSubject) => {
            await handleCancelRegistration(reviewingRegistration.id, emailContent, emailSubject);
            setReviewingRegistration(null);
          }}
        />
      )}
    </>
  );
}
