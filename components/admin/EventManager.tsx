'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import type { Event } from '@/types/event';
import type { EventType } from '@/types/event-type';
import type { Venue } from '@/types/venue';
import type { Book } from '@/types/book';

type EventManagerProps = {
  initialEvents: Event[];
  initialVenues: Venue[];
  initialBooks: Book[];
};

type DraftEvent = Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'venue' | 'book'> & {
  id?: number;
  createdAt?: string;
  updatedAt?: string;
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

export default function EventManager({ initialEvents, initialVenues, initialBooks }: EventManagerProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [venues] = useState<Venue[]>(initialVenues);
  const [books] = useState<Book[]>(initialBooks);
  const [selectedEventId, setSelectedEventId] = useState<number | undefined>(initialEvents[0]?.id);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string | 'ALL'>('ALL');
  const [registrationCounts, setRegistrationCounts] = useState<Record<number, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(true);
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
      venueId: venues[0]?.id || 1,
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

  const getVenueName = (venueId: number) => {
    const venue = venues.find((v) => v.id === venueId);
    return venue ? `${venue.name} (${venue.maxCapacity})` : `Venue #${venueId}`;
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
                  {event.title || '(No Title)'}
                </div>
                <div className="text-xs text-white/50 mt-1 flex items-center justify-between">
                  <span>{new Date(event.eventDate).toLocaleDateString()} • {event.venue?.name || getVenueName(event.venueId)}</span>
                  {event.id !== undefined && (
                    <span className="text-blue-400 font-medium">
                      {loadingCounts ? '...' : `${regCount} registered`}
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
                disabled={isSaving || !selectedEvent.title || !selectedEvent.slug || !isRegistrationDatesValid(selectedEvent)}
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
            {/* Slug */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                Slug <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={selectedEvent.slug}
                onChange={(e) => updateEventField('slug', e.target.value)}
                placeholder="e.g., tw-2026-04"
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
              />
            </div>

            {/* Event Type & Venue */}
            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Venue <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedEvent.venueId}
                  onChange={(e) => updateEventField('venueId', parseInt(e.target.value))}
                  className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
                >
                  {venues.map((venue) => {
                    const currentRegCount = selectedEvent.id !== undefined ? (registrationCounts[selectedEvent.id] || 0) : 0;
                    const isDisabled = currentRegCount > venue.maxCapacity;
                    return (
                      <option key={venue.id} value={venue.id} disabled={isDisabled}>
                        {venue.name} (Max: {venue.maxCapacity}){isDisabled ? ' - Too small' : ''}
                      </option>
                    );
                  })}
                </select>
                {selectedEvent.id !== undefined && registrationCounts[selectedEvent.id] > 0 && (
                  <p className="mt-1 text-xs text-white/60">
                    {registrationCounts[selectedEvent.id]} people registered. Venues with smaller capacity are disabled.
                  </p>
                )}
              </div>
            </div>

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

            {/* Cover URLs */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">Cover URL (中文)</label>
              <input
                type="text"
                value={selectedEvent.coverUrl || ''}
                onChange={(e) => updateEventField('coverUrl', e.target.value)}
                placeholder="/images/events/..."
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white">Cover URL (English)</label>
              <input
                type="text"
                value={selectedEvent.coverUrlEn || ''}
                onChange={(e) => updateEventField('coverUrlEn', e.target.value)}
                placeholder="/images/events/..."
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
              />
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
    </div>
  );
}
