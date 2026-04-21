'use client';

import { useState } from 'react';
import type { RegistrationRecord } from '@/lib/registration-store';
import type { Event } from '@/types/event';
import CancelConfirmationModal from './CancelConfirmationModal';

type RegistrationReviewModalProps = {
  registration: RegistrationRecord;
  event: Event | undefined;
  emailConfig: { replyTo: string; siteUrl: string };
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onCancel?: (emailContent: string | null, emailSubject: string | null) => Promise<void>;
};

export default function RegistrationReviewModal({
  registration,
  event,
  emailConfig,
  onClose,
  onConfirm,
  onCancel,
}: RegistrationReviewModalProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Handle case where event is not found
  if (!event) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={onClose}
      >
        <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-brand-navy p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-semibold text-white">Error</h2>
          <p className="mt-4 text-white/70">Event not found for this registration.</p>
          <button
            onClick={onClose}
            className="mt-6 inline-flex min-h-11 items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm payment');
    } finally {
      setConfirming(false);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-brand-navy p-6 my-8">
        <h2 id="modal-title" className="text-2xl font-semibold font-outfit text-white">
          Review Registration
        </h2>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* User Information */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold font-outfit text-white">User Information</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-white/60">Name</dt>
                <dd className="mt-1 text-white">{registration.name}</dd>
              </div>
              <div>
                <dt className="text-white/60">Email</dt>
                <dd className="mt-1 text-white">{registration.email}</dd>
              </div>
              <div>
                <dt className="text-white/60">Profession</dt>
                <dd className="mt-1 text-white">{registration.profession}</dd>
              </div>
              <div>
                <dt className="text-white/60">Age</dt>
                <dd className="mt-1 text-white">{registration.age}</dd>
              </div>
            </dl>
          </div>

          {/* Event Information */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold font-outfit text-white">Event Information</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-white/60">Title</dt>
                <dd className="mt-1 text-white">{event.title}</dd>
              </div>
              <div>
                <dt className="text-white/60">Date</dt>
                <dd className="mt-1 text-white">
                  {new Date(event.eventDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-white/60">Location</dt>
                <dd className="mt-1 text-white">{event.venue?.name || 'N/A'}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Payment Section */}
        {(event.paymentAmount !== null || registration.bankAccount) && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold font-outfit text-white">Payment Information</h3>
            <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
              {event.paymentAmount !== null && (
                <div>
                  <dt className="text-white/60">Amount</dt>
                  <dd className="mt-1 text-xl font-semibold text-white">
                    {event.paymentCurrency} {event.paymentAmount}
                  </dd>
                </div>
              )}
              {registration.bankAccount && (
                <div>
                  <dt className="text-white/60">Bank Account (Last 5 digits)</dt>
                  <dd className="mt-1 font-mono text-white">{registration.bankAccount}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Audit Trail Section */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-lg font-semibold font-outfit text-white">Audit Trail</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <dt className="text-white/60">Request ID</dt>
                <dd className="mt-1 font-mono text-white">{registration.requestId || 'n/a'}</dd>
              </div>
              <div>
                <dt className="text-white/60">Visitor ID</dt>
                <dd className="mt-1 font-mono text-white">{registration.visitorId || 'n/a'}</dd>
              </div>
            </div>
            <div className="mt-4">
              <p className="mb-3 text-white/85 font-medium">Events</p>
              <div className="space-y-2">
                {(registration.auditTrail || []).map((entry, index) => (
                  <div key={`${registration.id}-${entry.at}-${entry.event}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="font-medium text-white">{entry.event}</p>
                    <p className="text-white/60">{new Date(entry.at).toLocaleString()} by {entry.actor}</p>
                    <p className="text-white/70">{entry.summary}</p>
                  </div>
                ))}
                {!registration.auditTrail?.length && (
                  <p className="text-white/60">No audit entries recorded.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-between gap-4">
          {registration.status !== 'cancelled' && onCancel && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              disabled={confirming}
              className="inline-flex min-h-11 items-center rounded-full bg-red-500 px-6 py-3 font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
            >
              Cancel Registration
            </button>
          )}
          {registration.status === 'cancelled' && (
            <div className="rounded-full bg-white/10 px-6 py-3 text-white/60 text-sm">
              This registration has been cancelled
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={confirming}
              className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              {registration.status === 'confirmed' ? 'Close' : 'Back'}
            </button>
            {registration.status !== 'confirmed' && registration.status !== 'cancelled' && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-3 font-semibold text-brand-navy transition hover:brightness-110 disabled:opacity-60"
              >
                {confirming ? 'Confirming…' : 'Confirm Payment'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && event && (
        <CancelConfirmationModal
          registration={registration}
          event={event}
          emailConfig={emailConfig}
          onClose={() => setShowCancelModal(false)}
          onConfirm={async (emailContent, emailSubject) => {
            if (onCancel) {
              await onCancel(emailContent, emailSubject);
              setShowCancelModal(false);
            }
          }}
        />
      )}
    </div>
  );
}
