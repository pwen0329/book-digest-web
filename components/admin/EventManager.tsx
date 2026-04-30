'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import type { Event } from '@/types/event';
import type { EventType } from '@/types/event-type';
import type { VenueLocation } from '@/types/event';
import type { PaymentCurrency } from '@/types/event';
import type { Book } from '@/types/book';
import type { SignupIntroTemplate } from '@/types/signup-intro';
import { VENUE_LOCATIONS } from '@/lib/venue-locations';
import IntroTemplateManager from './IntroTemplateManager';

type EventManagerProps = {
  initialEvents: Event[];
  initialBooks: Book[];
};

type DraftEvent = Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'book' | 'introTemplate'> & {
  id?: number;
  createdAt?: string;
  updatedAt?: string;
};

type UploadedAsset = {
  src: string;
  format?: string;
  blurDataURL?: string;
};

async function uploadAsset(file: File): Promise<UploadedAsset> {
  const formData = new FormData();
  formData.set('file', file);

  const response = await fetch('/api/admin/upload?scope=events', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const payload = await response.json().catch(() => ({ error: 'Upload failed.' }));
  if (!response.ok || !payload.src) {
    throw new Error(payload.error || 'Upload failed.');
  }

  return payload as UploadedAsset;
}

const PAYMENT_CURRENCIES: Record<PaymentCurrency, { label: string; symbol: string }> = {
  TWD: { label: 'TWD (台幣)', symbol: 'NT$' },
  EUR: { label: 'EUR (歐元)', symbol: '€' },
  USD: { label: 'USD (美金)', symbol: '$' },
};

function toLocalDateTimeInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoString(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export default function EventManager({ initialEvents, initialBooks }: EventManagerProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [books] = useState<Book[]>(initialBooks);
  const [introTemplates, setIntroTemplates] = useState<SignupIntroTemplate[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | undefined>(initialEvents[0]?.id);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string | 'ALL'>('ALL');
  const [registrationCounts, setRegistrationCounts] = useState<Record<number, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(true);
  const [loadingIntroTemplates, setLoadingIntroTemplates] = useState(true);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [uploadingAssetKey, setUploadingAssetKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Fetch event types from API
  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const response = await fetch('/api/admin/event-types');
        if (response.ok) {
          const data = await response.json();
          setEventTypes(data.eventTypes || []);
        }
      } catch (error) {
        console.error('Failed to fetch event types:', error);
      } finally {
        setLoadingEventTypes(false);
      }
    };
    fetchEventTypes();
  }, []);

  const fetchIntroTemplates = async () => {
    try {
      const response = await fetch('/api/admin/intro-templates');
      if (response.ok) {
        const data = await response.json();
        setIntroTemplates(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch intro templates:', error);
    } finally {
      setLoadingIntroTemplates(false);
    }
  };

  // Fetch intro templates from API
  useEffect(() => {
    fetchIntroTemplates();
  }, []);

  const filteredEvents = filterType === 'ALL'
    ? events
    : events.filter(e => e.eventTypeCode === filterType);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  // Fetch registration counts for all events
  const fetchRegistrationCounts = useCallback(async () => {
    const eventIds = events.filter(e => e.id !== undefined).map(e => e.id!);
    if (eventIds.length === 0) return;

    setLoadingCounts(true);
    try {
      const counts: Record<number, number> = {};
      await Promise.all(
        eventIds.map(async (id) => {
          try {
            const response = await fetch(`/api/admin/registrations/count?eventId=${id}`);
            if (response.ok) {
              const data = await response.json();
              counts[id] = data.count || 0;
            }
          } catch (error) {
            console.error(`Failed to fetch count for event ${id}:`, error);
          }
        })
      );
      setRegistrationCounts(counts);
    } finally {
      setLoadingCounts(false);
    }
  }, [events]);

  useEffect(() => {
    fetchRegistrationCounts();
  }, [fetchRegistrationCounts]);

  const createDraftEvent = (): DraftEvent => {
    const now = Date.now();
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const eventDate = now + oneMonth; // Today + 1 month
    const registrationClosesAt = eventDate - (24 * 60 * 60 * 1000); // Event date - 1 day

    return {
      slug: `event-${Date.now()}`,
      eventTypeCode: eventTypes[0]?.code || 'MANDARIN_BOOK_CLUB',
      venueName: undefined,
      venueNameEn: undefined,
      venueCapacity: 30,
      venueAddress: undefined,
      venueLocation: 'TW',
      paymentAmount: 0,
      paymentCurrency: 'TWD',
      introTemplateName: 'default_paid',
      title: '',
      titleEn: '',
      description: '',
      descriptionEn: '',
      eventDate: new Date(eventDate).toISOString(),
      registrationOpensAt: new Date().toISOString(), // Today
      registrationClosesAt: new Date(registrationClosesAt).toISOString(),
      bookId: undefined,
      coverUrl: '',
      coverUrlEn: '',
      isPublished: false,
    };
  };

  const addEvent = () => {
    const draft = createDraftEvent();
    const draftWithId: DraftEvent = { ...draft, id: undefined };
    setEvents([draftWithId as Event, ...events]);
    setSelectedEventId(undefined);
  };

  const deleteEvent = async (id: number | undefined) => {
    if (id === undefined) {
      setEvents(events.filter((e) => e.id !== undefined));
      setSelectedEventId(events.find((e) => e.id !== undefined)?.id);
      return;
    }

    if (!confirm('Delete this event? Registrations linked to this event will be affected.')) {
      return;
    }

    setIsSaving(true);
    setSaveStatus('Deleting...');

    try {
      const response = await fetch(`/api/admin/event-v2/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }

      setEvents(events.filter((e) => e.id !== id));
      setSelectedEventId(events.find((e) => e.id !== id)?.id);
      setSaveStatus('Deleted');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSaveStatus(`Error: ${errorMessage}`);
      console.error('Delete event error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const saveEvent = async (event: DraftEvent) => {
    setIsSaving(true);
    setSaveStatus('Saving...');

    try {
      if (event.id === undefined) {
        const response = await fetch('/api/admin/event-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Create failed');
        }

        const { event: newEvent } = await response.json();
        setEvents(events.map((e) => (e.id === undefined ? newEvent : e)));
        setSelectedEventId(newEvent.id);
        setSaveStatus('Created');
      } else {
        const response = await fetch(`/api/admin/event-v2/${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Update failed');
        }

        const { event: updatedEvent } = await response.json();
        setEvents(events.map((e) => (e.id === event.id ? updatedEvent : e)));
        setSaveStatus('Saved');
      }
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSaveStatus(`Error: ${errorMessage}`);
      console.error('Save event error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateEventField = (field: keyof DraftEvent, value: string | number | boolean | undefined) => {
    if (!selectedEvent) return;
    const updated = { ...selectedEvent, [field]: value };
    setEvents(events.map((e) => (e.id === selectedEventId ? updated : e)));
  };

  const getEventTypeName = (code: string) => {
    const eventType = eventTypes.find((t) => t.code === code);
    return eventType ? eventType.nameEn : code;
  };

  // Validate registration dates
  const isRegistrationDatesValid = (event: DraftEvent | Event): boolean => {
    if (!event.registrationOpensAt || !event.registrationClosesAt) return false;
    const opensAt = new Date(event.registrationOpensAt);
    const closesAt = new Date(event.registrationClosesAt);
    const eventDate = new Date(event.eventDate);

    // Registration closes must be after opens
    if (closesAt <= opensAt) return false;

    // Registration closes must not be after event date
    if (closesAt > eventDate) return false;

    return true;
  };

  // Check if registration closes is after event date
  const isRegClosesAfterEventDate = (event: DraftEvent | Event): boolean => {
    if (!event.registrationClosesAt || !event.eventDate) return false;
    return new Date(event.registrationClosesAt) > new Date(event.eventDate);
  };

  // Validate that online venue is only used with compatible event types
  const isOnlineVenueValid = (event: DraftEvent | Event): boolean => {
    if (event.venueLocation !== 'ONLINE') return true;

    const eventType = eventTypes.find(t => t.code === event.eventTypeCode);
    return eventType?.onlinePossible ?? false;
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      {/* Event List */}
      <div className="rounded-[28px] border border-white/10 bg-white/10 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Events ({filteredEvents.length})</h3>
          <button
            onClick={addEvent}
            className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
          >
            + New
          </button>
        </div>

        {/* Filter */}
        <div className="mb-4 relative">
          <select
            aria-label="Filter by event type"
            value={filterType}
            onChange={(e) => {
              const newValue = e.target.value;
              startTransition(() => {
                setFilterType(newValue);
              });
            }}
            className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white"
            disabled={loadingEventTypes || isPending}
          >
            <option value="ALL">All Types</option>
            {eventTypes.map((type) => (
              <option key={type.code} value={type.code}>{type.nameEn}</option>
            ))}
          </select>
          {isPending && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <svg
                className="animate-spin h-4 w-4 text-white/60"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredEvents.map((event) => {
            const regCount = event.id !== undefined ? (registrationCounts[event.id] || 0) : 0;
            return (
              <button
                key={event.id ?? 'draft'}
                onClick={() => setSelectedEventId(event.id)}
                className={`w-full rounded-lg p-3 text-left transition-colors ${
                  selectedEventId === event.id
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-white/75 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-white/60">{getEventTypeName(event.eventTypeCode)}</span>
                  {event.id === undefined && (
                    <span className="text-xs text-yellow-400">(Draft)</span>
                  )}
                  {!event.isPublished && event.id !== undefined && (
                    <span className="text-xs text-orange-400">(Unpublished)</span>
                  )}
                </div>
                <div className="font-medium truncate">
                  {event.title || event.titleEn || '(No Title)'}
                </div>
                <div className="text-xs text-white/50 mt-1 flex items-center justify-between">
                  <span>{new Date(event.eventDate).toLocaleDateString()} • {event.venueName || VENUE_LOCATIONS[event.venueLocation]?.displayName || event.venueLocation}</span>
                  {event.id !== undefined && (
                    <span className={`font-medium ${regCount >= event.venueCapacity ? 'text-red-400' : 'text-blue-400'}`}>
                      {loadingCounts ? '...' : `(${regCount}/${event.venueCapacity})`}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Event Editor */}
      {selectedEvent ? (
        <div className="rounded-[28px] border border-white/10 bg-white/10 p-6 max-h-[800px] overflow-y-auto">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">
              {selectedEvent.id === undefined ? 'New Event' : 'Edit Event'}
            </h3>
            <div className="flex items-center gap-3">
              {saveStatus && (
                <span
                  className={`text-sm ${
                    saveStatus.startsWith('Error') ? 'text-red-400' : 'text-green-400'
                  }`}
                >
                  {saveStatus}
                </span>
              )}
              <button
                onClick={() => saveEvent(selectedEvent)}
                disabled={isSaving || !selectedEvent.title || !isRegistrationDatesValid(selectedEvent) || !isOnlineVenueValid(selectedEvent)}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {selectedEvent.id === undefined ? 'Create' : 'Save'}
              </button>
              {selectedEvent.id !== undefined && (
                <button
                  onClick={() => deleteEvent(selectedEvent.id)}
                  disabled={isSaving}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                Title (中文) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={selectedEvent.title}
                onChange={(e) => updateEventField('title', e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white">Title (English)</label>
              <input
                type="text"
                value={selectedEvent.titleEn || ''}
                onChange={(e) => updateEventField('titleEn', e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
              />
            </div>

            {/* Cover URLs */}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">Cover URL (中文)</h3>
                  <label className="cursor-pointer rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10">
                    {uploadingAssetKey === 'event-cover-zh' ? 'Processing…' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !selectedEvent) return;
                        setUploadingAssetKey('event-cover-zh');
                        try {
                          const asset = await uploadAsset(file);
                          const updatedEvent = {
                            ...selectedEvent,
                            coverUrl: asset.src,
                            coverBlurDataURL: asset.blurDataURL
                          };
                          setEvents(events.map((e) => (e.id === selectedEventId ? updatedEvent : e)));
                          await saveEvent(updatedEvent);
                          setSaveStatus(`Cover uploaded and saved (${asset.format || 'webp'})`);
                        } catch (err) {
                          console.error('Upload failed:', err);
                          setSaveStatus(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                        } finally {
                          setUploadingAssetKey(null);
                        }
                      }}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={selectedEvent.coverUrl || ''}
                  onChange={(e) => updateEventField('coverUrl', e.target.value)}
                  placeholder="/images/events/..."
                  className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">Cover URL (English)</h3>
                  <label className="cursor-pointer rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10">
                    {uploadingAssetKey === 'event-cover-en' ? 'Processing…' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !selectedEvent) return;
                        setUploadingAssetKey('event-cover-en');
                        try {
                          const asset = await uploadAsset(file);
                          const updatedEvent = {
                            ...selectedEvent,
                            coverUrlEn: asset.src,
                            coverBlurDataURLEn: asset.blurDataURL
                          };
                          setEvents(events.map((e) => (e.id === selectedEventId ? updatedEvent : e)));
                          await saveEvent(updatedEvent);
                          setSaveStatus(`Cover uploaded and saved (${asset.format || 'webp'})`);
                        } catch (err) {
                          console.error('Upload failed:', err);
                          setSaveStatus(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                        } finally {
                          setUploadingAssetKey(null);
                        }
                      }}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={selectedEvent.coverUrlEn || ''}
                  onChange={(e) => updateEventField('coverUrlEn', e.target.value)}
                  placeholder="/images/events/..."
                  className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
                />
              </div>
            </div>

            {/* Venue Section */}
            <div className="rounded-lg border border-white/10 bg-black/10 p-4 space-y-4">
              <h4 className="text-sm font-semibold text-white">Venue Information</h4>

              {/* Venue Location & Capacity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">
                    Location <span className="text-red-400">*</span>
                  </label>
                  <select
                    aria-label="Venue location"
                    value={selectedEvent.venueLocation}
                    onChange={(e) => updateEventField('venueLocation', e.target.value as VenueLocation)}
                    className={`w-full rounded-lg border px-4 py-2 text-white ${
                      selectedEvent.venueLocation === 'ONLINE' && !isOnlineVenueValid(selectedEvent)
                        ? 'border-red-500 bg-black/20'
                        : 'border-white/20 bg-black/20'
                    }`}
                  >
                    {Object.entries(VENUE_LOCATIONS).map(([code, config]) => (
                      <option key={code} value={code}>
                        {config.displayName} ({config.displayNameZh})
                      </option>
                    ))}
                  </select>
                  {selectedEvent.venueLocation === 'ONLINE' && !isOnlineVenueValid(selectedEvent) && (
                    <p className="mt-1 text-sm text-red-400">
                      {(() => {
                        const type = eventTypes.find(t => t.code === selectedEvent.eventTypeCode);
                        return type ? `${type.nameEn} cannot be held online` : 'This event type cannot be held online';
                      })()}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">
                    Capacity <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={selectedEvent.venueCapacity}
                    onChange={(e) => updateEventField('venueCapacity', parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
                  />
                  {selectedEvent.id !== undefined && registrationCounts[selectedEvent.id] > 0 && (
                    <p className={`mt-1 text-xs ${registrationCounts[selectedEvent.id] >= selectedEvent.venueCapacity ? 'text-red-400' : 'text-white/60'}`}>
                      ({registrationCounts[selectedEvent.id]}/{selectedEvent.venueCapacity})
                      {registrationCounts[selectedEvent.id] > selectedEvent.venueCapacity && (
                        <span className="text-red-400"> - Capacity is less than registrations!</span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Venue Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">Venue Name (中文)</label>
                  <input
                    type="text"
                    value={selectedEvent.venueName || ''}
                    onChange={(e) => updateEventField('venueName', e.target.value || undefined)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">Venue Name (English)</label>
                  <input
                    type="text"
                    value={selectedEvent.venueNameEn || ''}
                    onChange={(e) => updateEventField('venueNameEn', e.target.value || undefined)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
                  />
                </div>
              </div>

              {/* Venue Address */}
              <div>
                <label className="mb-2 block text-sm font-medium text-white">Venue Address</label>
                <input
                  type="text"
                  value={selectedEvent.venueAddress || ''}
                  onChange={(e) => updateEventField('venueAddress', e.target.value || undefined)}
                  placeholder="Optional - if empty, default message will be shown"
                  className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
                />
                <p className="mt-1 text-xs text-white/40">
                  Leave empty to show: &quot;Event location will be informed one week before the event happens&quot;
                </p>
              </div>
            </div>

            {/* Event Type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                Type <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedEvent.eventTypeCode}
                onChange={(e) => updateEventField('eventTypeCode', e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
                disabled={loadingEventTypes}
              >
                {eventTypes.map((type) => (
                  <option key={type.code} value={type.code}>{type.nameEn} ({type.nameZh})</option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                Event Date <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={toLocalDateTimeInput(selectedEvent.eventDate)}
                onChange={(e) => updateEventField('eventDate', toIsoString(e.target.value))}
                className={`w-full rounded-lg border px-4 py-2 text-white ${
                  isRegClosesAfterEventDate(selectedEvent)
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-white/20 bg-black/20'
                }`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Registration Opens <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={toLocalDateTimeInput(selectedEvent.registrationOpensAt)}
                  onChange={(e) => updateEventField('registrationOpensAt', toIsoString(e.target.value))}
                  className={`w-full rounded-lg border px-4 py-2 text-white ${
                    !isRegistrationDatesValid(selectedEvent)
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-white/20 bg-black/20'
                  }`}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Registration Closes <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={toLocalDateTimeInput(selectedEvent.registrationClosesAt)}
                  onChange={(e) => updateEventField('registrationClosesAt', toIsoString(e.target.value))}
                  className={`w-full rounded-lg border px-4 py-2 text-white ${
                    !isRegistrationDatesValid(selectedEvent)
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-white/20 bg-black/20'
                  }`}
                />
              </div>
            </div>
            {!isRegistrationDatesValid(selectedEvent) && (
              <p className="text-xs text-red-400">
                {isRegClosesAfterEventDate(selectedEvent)
                  ? 'Registration close time must not be after event date'
                  : 'Registration close time must be after open time'}
              </p>
            )}

            {/* Description */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">Description (中文)</label>
              <textarea
                value={selectedEvent.description || ''}
                onChange={(e) => updateEventField('description', e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white">Description (English)</label>
              <textarea
                value={selectedEvent.descriptionEn || ''}
                onChange={(e) => updateEventField('descriptionEn', e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
              />
            </div>

            {/* Payment Section */}
            <div className="rounded-lg border border-white/10 bg-black/10 p-4 space-y-4">
              <h4 className="text-sm font-semibold text-white">Payment Information</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">
                    Amount <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={selectedEvent.paymentAmount}
                    onChange={(e) => updateEventField('paymentAmount', parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
                  />
                  <p className="mt-1 text-xs text-white/40">Use 0 for free events</p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">
                    Currency <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={selectedEvent.paymentCurrency}
                    onChange={(e) => updateEventField('paymentCurrency', e.target.value as PaymentCurrency)}
                    className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
                  >
                    {Object.entries(PAYMENT_CURRENCIES).map(([code, config]) => (
                      <option key={code} value={code}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Intro Template */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-white">
                  Signup Intro Template <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowTemplateManager(true)}
                  className="text-xs text-brand-pink hover:underline"
                >
                  Manage Templates
                </button>
              </div>
              <select
                value={selectedEvent.introTemplateName}
                onChange={(e) => updateEventField('introTemplateName', e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
                disabled={loadingIntroTemplates}
              >
                {introTemplates.map((template) => (
                  <option key={template.name} value={template.name}>
                    {template.name} {template.isFree ? '(Free)' : '(Paid)'}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-white/40">
                Template shown during signup. Payment variables will be automatically filled.
              </p>
            </div>

            {/* Book */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">Related Book (Optional)</label>
              <select
                value={selectedEvent.bookId || ''}
                onChange={(e) => updateEventField('bookId', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
              >
                <option value="">None</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Published */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white">
                <input
                  type="checkbox"
                  checked={selectedEvent.isPublished}
                  onChange={(e) => updateEventField('isPublished', e.target.checked)}
                  className="rounded border-white/20"
                />
                Published (visible to public)
              </label>
            </div>

            {/* Metadata */}
            {selectedEvent.id !== undefined && (
              <div className="mt-6 rounded-lg border border-white/10 bg-black/10 p-4 text-xs text-white/50">
                <div>ID: {selectedEvent.id}</div>
                <div>Created: {new Date(selectedEvent.createdAt).toLocaleString()}</div>
                <div>Updated: {new Date(selectedEvent.updatedAt).toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-[28px] border border-white/10 bg-white/10 p-6">
          <p className="text-white/50">Select an event or create a new one</p>
        </div>
      )}

      {/* Intro Template Manager Modal */}
      <IntroTemplateManager
        open={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        onTemplatesChanged={() => {
          setLoadingIntroTemplates(true);
          fetchIntroTemplates();
        }}
      />
    </div>
  );
}
