'use client';

import { useEffect, useMemo, useRef, useState, useTransition, useCallback } from 'react';
import { getNextBookSortOrder, sortBooksDescending } from '@/lib/book-order';
import type { Book } from '@/types/book';
import type { EventContentId, EventContentMap } from '@/types/event-content';
import type { RegistrationEmailLocale, RegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';
import type { CapacityConfigFile, SignupLocation } from '@/lib/signup-capacity-config';
import type { RegistrationAuditSummary, RegistrationRecord, RegistrationRecordStatus } from '@/lib/registration-store';

type AdminDashboardProps = {
  initialBooks: Book[];
  initialEvents: EventContentMap;
  initialCapacity: CapacityConfigFile;
  initialRegistrationEmails: RegistrationSuccessEmailSettings;
  initialDocumentVersions: {
    books: string | null;
    events: string | null;
    capacity: string | null;
    emails: string | null;
  };
};

type DashboardTab = 'books' | 'events' | 'capacity' | 'emails' | 'registrations';

type CapacityLiveStatus = {
  enabled: boolean;
  open: boolean;
  full: boolean;
  count: number;
  max: number | null;
  reason: 'ok' | 'closed' | 'full';
};

const EVENT_IDS: EventContentId[] = ['TW', 'EN', 'NL', 'DETOX'];
const CAPACITY_IDS: SignupLocation[] = ['TW', 'EN', 'NL', 'DETOX'];
const REGISTRATION_SOURCES = ['pending', 'simulated', 'tally', 'notion'] as const;

function linesToArray(value: string): string[] | undefined {
  const items = value.split('\n').map((item) => item.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function arrayToLines(value?: string[]): string {
  return value?.join('\n') || '';
}

function tagsToInput(value?: string[]): string {
  return value?.join(', ') || '';
}

function inputToTags(value: string): string[] | undefined {
  const items = value.split(',').map((item) => item.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function toLocalDateTimeInput(value?: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (segment: number) => String(segment).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoString(value: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

type UploadedAsset = {
  src: string;
  width?: number;
  height?: number;
  format?: string;
  blurDataURL?: string;
};

type RegistrationsResponse = {
  items: RegistrationRecord[];
  summary: RegistrationAuditSummary;
  viewerSource: string;
  notionMirrorEnabled: boolean;
};

async function uploadAsset(scope: 'books' | 'events', file: File): Promise<UploadedAsset> {
  const formData = new FormData();
  formData.set('file', file);

  const response = await fetch(`/api/admin/upload?scope=${scope}`, {
    method: 'POST',
    body: formData,
  });

  const payload = await response.json().catch(() => ({ error: 'Upload failed.' }));
  if (!response.ok || !payload.src) {
    throw new Error(payload.error || 'Upload failed.');
  }

  return payload as UploadedAsset;
}

function createDraftBook(existingBooks: Book[]): Book {
  const index = existingBooks.length + 1;
  const slugBase = `new-book-${index}`;
  const slug = existingBooks.some((book) => book.slug === slugBase)
    ? `new-book-${Date.now()}`
    : slugBase;

  return {
    id: `draft-${Date.now()}`,
    sortOrder: getNextBookSortOrder(existingBooks),
    slug,
    title: '新書籍',
    titleEn: 'New Book',
    author: '作者名稱',
    authorEn: 'Author Name',
    readDate: '',
    summary: '',
    summaryEn: '',
    readingNotes: '',
    readingNotesEn: '',
    discussionPoints: [],
    discussionPointsEn: [],
    tags: [],
    links: {},
  };
}

export default function AdminDashboard({ initialBooks, initialEvents, initialCapacity, initialRegistrationEmails, initialDocumentVersions }: AdminDashboardProps) {
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('books');
  const [books, setBooks] = useState<Book[]>(() => sortBooksDescending(initialBooks));
  const [events, setEvents] = useState<EventContentMap>(initialEvents);
  const [capacity, setCapacity] = useState<CapacityConfigFile>(initialCapacity);
  const [registrationEmails, setRegistrationEmails] = useState<RegistrationSuccessEmailSettings>(initialRegistrationEmails);
  const [documentVersions, setDocumentVersions] = useState(initialDocumentVersions);
  const documentVersionsRef = useRef(initialDocumentVersions);
  const [capacityStatus, setCapacityStatus] = useState<Partial<Record<SignupLocation, CapacityLiveStatus>>>({});
  const [capacityStatusLoading, setCapacityStatusLoading] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | number | null>(initialBooks[0]?.id ?? null);
  const [visibleBookCount, setVisibleBookCount] = useState(10);
  const [draggedBookId, setDraggedBookId] = useState<string | number | null>(null);
  const [uploadingAssetKey, setUploadingAssetKey] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<EventContentId>('TW');
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [registrationsSummary, setRegistrationsSummary] = useState<RegistrationAuditSummary | null>(null);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationsViewerSource, setRegistrationsViewerSource] = useState<string>('registration-store');
  const [registrationsMirrorEnabled, setRegistrationsMirrorEnabled] = useState(false);
  const [registrationLocationFilter, setRegistrationLocationFilter] = useState<'ALL' | SignupLocation>('ALL');
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState<'ALL' | RegistrationRecordStatus>('ALL');
  const [registrationSourceFilter, setRegistrationSourceFilter] = useState<'ALL' | RegistrationRecord['source']>('ALL');
  const [registrationSearch, setRegistrationSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    documentVersionsRef.current = documentVersions;
  }, [documentVersions]);

  useEffect(() => {
    if (activeTab !== 'capacity') {
      return;
    }

    let cancelled = false;

    async function refreshCapacityStatus() {
      setCapacityStatusLoading(true);
      try {
        const entries = await Promise.all(CAPACITY_IDS.map(async (location) => {
          const response = await fetch(`/api/submit?loc=${location}`, { cache: 'no-store' });
          if (!response.ok) {
            throw new Error(`Unable to load capacity status for ${location}`);
          }
          const payload = await response.json();
          return [location, {
            enabled: payload.enabled === true,
            open: payload.open !== false,
            full: payload.full === true,
            count: typeof payload.count === 'number' ? payload.count : 0,
            max: typeof payload.max === 'number' ? payload.max : null,
            reason: payload.reason === 'closed' || payload.reason === 'full' ? payload.reason : 'ok',
          } satisfies CapacityLiveStatus] as const;
        }));

        if (!cancelled) {
          setCapacityStatus(Object.fromEntries(entries));
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : 'Unable to load capacity status.');
        }
      } finally {
        if (!cancelled) {
          setCapacityStatusLoading(false);
        }
      }
    }

    void refreshCapacityStatus();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const selectedBookIndex = books.findIndex((book) => book.id === selectedBookId);
  const selectedBook = selectedBookIndex >= 0 ? books[selectedBookIndex] : books[0];
  const visibleBooks = useMemo(() => books.slice(0, visibleBookCount), [books, visibleBookCount]);

  useEffect(() => {
    if (!books.length) {
      if (selectedBookId !== null) {
        setSelectedBookId(null);
      }
      return;
    }

    if (!books.some((book) => book.id === selectedBookId)) {
      setSelectedBookId(books[0].id);
    }
  }, [books, selectedBookId]);

  useEffect(() => {
    if (selectedBookIndex >= visibleBookCount && selectedBookIndex !== -1) {
      setVisibleBookCount(selectedBookIndex + 1);
    }
  }, [selectedBookIndex, visibleBookCount]);

  function updateSelectedBook(patch: Partial<Book>) {
    if (!selectedBook) {
      return;
    }

    setBooks((currentBooks) => currentBooks.map((book, index) => {
      if (index !== selectedBookIndex) {
        return book;
      }

      return { ...book, ...patch };
    }));
  }

  function buildBooksWithSelectedPatch(patch: Partial<Book>): Book[] {
    if (!selectedBook) {
      return books;
    }

    return books.map((book, index) => {
      if (index !== selectedBookIndex) {
        return book;
      }

      return { ...book, ...patch };
    });
  }

  function updateEventField(field: keyof EventContentMap[EventContentId], value: EventContentMap[EventContentId][keyof EventContentMap[EventContentId]]) {
    setEvents((currentEvents) => ({
      ...currentEvents,
      [selectedEventId]: {
        ...currentEvents[selectedEventId],
        [field]: value,
      },
    }));
  }

  function updateCapacityField(location: SignupLocation, field: keyof NonNullable<CapacityConfigFile[SignupLocation]>, value: string | number | boolean) {
    setCapacity((currentCapacity) => ({
      ...currentCapacity,
      [location]: {
        ...currentCapacity[location],
        [field]: value,
      },
    }));
  }

  function updateRegistrationEmailField(locale: RegistrationEmailLocale, field: 'subject' | 'body', value: string) {
    setRegistrationEmails((currentSettings) => ({
      ...currentSettings,
      templates: {
        ...currentSettings.templates,
        [locale]: {
          ...currentSettings.templates[locale],
          [field]: value,
        },
      },
    }));
  }

  function resetFlash() {
    setMessage(null);
    setError(null);
  }

  function moveBook(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= books.length || toIndex >= books.length) {
      return;
    }

    setBooks((currentBooks) => {
      const nextBooks = [...currentBooks];
      const [movedBook] = nextBooks.splice(fromIndex, 1);
      nextBooks.splice(toIndex, 0, movedBook);
      return normalizeLocalBookOrder(nextBooks);
    });
    setMessage('Book order updated locally. Save books to publish the new order.');
    setError(null);
  }

  function normalizeLocalBookOrder(nextBooks: Book[]): Book[] {
    const maxOrder = nextBooks.length;
    return nextBooks.map((book, index) => ({
      ...book,
      sortOrder: maxOrder - index,
    }));
  }

  function deleteSelectedBook() {
    if (!selectedBook) {
      return;
    }

    const confirmed = window.confirm(`Delete "${selectedBook.title}"? This removes it from the public site after saving.`);
    if (!confirmed) {
      return;
    }

    setBooks((currentBooks) => normalizeLocalBookOrder(currentBooks.filter((book) => book.id !== selectedBook.id)));
    setMessage('Book removed locally. Save books to publish the deletion.');
    setError(null);
  }

  const refreshRegistrations = useCallback(async () => {
    setRegistrationsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (registrationLocationFilter !== 'ALL') {
        params.set('location', registrationLocationFilter);
      }
      if (registrationStatusFilter !== 'ALL') {
        params.set('status', registrationStatusFilter);
      }
      if (registrationSourceFilter !== 'ALL') {
        params.set('source', registrationSourceFilter);
      }
      if (registrationSearch.trim()) {
        params.set('search', registrationSearch.trim());
      }

      const response = await fetch(`/api/registrations?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as RegistrationsResponse | null;
      if (!response.ok || !payload) {
        throw new Error(payload && 'error' in payload ? String((payload as { error?: unknown }).error) : 'Unable to load registrations.');
      }

      setRegistrations(payload.items || []);
      setRegistrationsSummary(payload.summary || null);
      setRegistrationsViewerSource(payload.viewerSource || 'registration-store');
      setRegistrationsMirrorEnabled(payload.notionMirrorEnabled === true);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load registrations.');
    } finally {
      setRegistrationsLoading(false);
    }
  }, [registrationLocationFilter, registrationSearch, registrationSourceFilter, registrationStatusFilter]);

  useEffect(() => {
    if (activeTab !== 'registrations') {
      return;
    }

    void refreshRegistrations();
  }, [activeTab, refreshRegistrations]);

  async function saveBooks(nextBooksOverride?: Book[], successMessage = 'Books updated. Public pages were revalidated.') {
    resetFlash();

    const sourceBooks = nextBooksOverride || books;
    const payloadBooks = sourceBooks.map((book) => ({
      ...book,
      coverUrls: book.coverUrls?.filter(Boolean),
      coverUrlsEn: book.coverUrlsEn?.filter(Boolean),
      discussionPoints: book.discussionPoints?.filter(Boolean),
      discussionPointsEn: book.discussionPointsEn?.filter(Boolean),
      tags: book.tags?.filter(Boolean),
    }));

    const response = await fetch('/api/admin/books', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ books: payloadBooks, expectedUpdatedAt: documentVersionsRef.current.books }),
    });

    const payload = await response.json().catch(() => ({ error: 'Unable to save books.' }));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to save books.');
    }

    const nextUpdatedAt = (payload.updatedAt as string | null | undefined) ?? documentVersionsRef.current.books;
    setBooks(sortBooksDescending(payload.books as Book[]));
    documentVersionsRef.current = { ...documentVersionsRef.current, books: nextUpdatedAt ?? null };
    setDocumentVersions((currentVersions) => ({ ...currentVersions, books: nextUpdatedAt ?? currentVersions.books }));
    setMessage(successMessage);
  }

  async function saveEvents(nextEventsOverride?: EventContentMap, successMessage = 'Event content and posters updated. Public event pages were revalidated.') {
    resetFlash();

    const response = await fetch('/api/admin/events', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: nextEventsOverride || events, expectedUpdatedAt: documentVersionsRef.current.events }),
    });

    const payload = await response.json().catch(() => ({ error: 'Unable to save events.' }));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to save events.');
    }

    const nextUpdatedAt = (payload.updatedAt as string | null | undefined) ?? documentVersionsRef.current.events;
    setEvents(payload.events as EventContentMap);
    documentVersionsRef.current = { ...documentVersionsRef.current, events: nextUpdatedAt ?? null };
    setDocumentVersions((currentVersions) => ({ ...currentVersions, events: nextUpdatedAt ?? currentVersions.events }));
    setMessage(successMessage);
  }

  async function saveCapacity() {
    resetFlash();

    const response = await fetch('/api/admin/capacity', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity, expectedUpdatedAt: documentVersionsRef.current.capacity }),
    });

    const payload = await response.json().catch(() => ({ error: 'Unable to save capacity settings.' }));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to save capacity settings.');
    }

    const nextUpdatedAt = (payload.updatedAt as string | null | undefined) ?? documentVersionsRef.current.capacity;
    setCapacity(payload.capacity as CapacityConfigFile);
    documentVersionsRef.current = { ...documentVersionsRef.current, capacity: nextUpdatedAt ?? null };
    setDocumentVersions((currentVersions) => ({ ...currentVersions, capacity: nextUpdatedAt ?? currentVersions.capacity }));
    setMessage('Signup windows and capacity settings updated.');

    const refreshedStatus = await Promise.all(CAPACITY_IDS.map(async (location) => {
      const response = await fetch(`/api/submit?loc=${location}`, { cache: 'no-store' });
      const payloadStatus = await response.json().catch(() => null);
      return [location, {
        enabled: payloadStatus?.enabled === true,
        open: payloadStatus?.open !== false,
        full: payloadStatus?.full === true,
        count: typeof payloadStatus?.count === 'number' ? payloadStatus.count : 0,
        max: typeof payloadStatus?.max === 'number' ? payloadStatus.max : null,
        reason: payloadStatus?.reason === 'closed' || payloadStatus?.reason === 'full' ? payloadStatus.reason : 'ok',
      } satisfies CapacityLiveStatus] as const;
    }));
    setCapacityStatus(Object.fromEntries(refreshedStatus));
  }

  async function saveRegistrationEmails() {
    resetFlash();

    const response = await fetch('/api/admin/email', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: registrationEmails, expectedUpdatedAt: documentVersionsRef.current.emails }),
    });

    const payload = await response.json().catch(() => ({ error: 'Unable to save registration email settings.' }));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to save registration email settings.');
    }

    const nextUpdatedAt = (payload.updatedAt as string | null | undefined) ?? documentVersionsRef.current.emails;
    setRegistrationEmails(payload.settings as RegistrationSuccessEmailSettings);
    documentVersionsRef.current = { ...documentVersionsRef.current, emails: nextUpdatedAt ?? null };
    setDocumentVersions((currentVersions) => ({ ...currentVersions, emails: nextUpdatedAt ?? currentVersions.emails }));
    setMessage('Registration success email settings updated.');
  }

  async function logout() {
    setLoggingOut(true);

    try {
      await fetch('/api/admin/session', { method: 'DELETE' });
      window.location.reload();
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleAction(action: () => Promise<void>) {
    startTransition(() => {
      void action().catch((actionError) => {
        setError(actionError instanceof Error ? actionError.message : 'Unexpected error.');
      });
    });
  }

  const selectedEvent = events[selectedEventId];

  function addBook() {
    const draft = createDraftBook(books);
    setBooks((currentBooks) => normalizeLocalBookOrder([draft, ...currentBooks]));
    setSelectedBookId(draft.id);
    setVisibleBookCount((currentCount) => Math.max(10, currentCount + 1));
    setActiveTab('books');
    setMessage('Draft book added. Fill in the fields and save books to publish it.');
    setError(null);
  }

  return (
    <section data-dashboard-ready={hydrated ? 'true' : 'false'} className="min-h-screen bg-brand-navy px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-outfit text-xs uppercase tracking-[0.35em] text-brand-pink">Book Digest Admin</p>
              <h1 className="mt-3 text-3xl font-bold font-outfit">Content operations dashboard</h1>
              <p className="mt-2 max-w-3xl text-white/70">
                Edit books, update the current monthly posters and copy, and control registration windows with automatic full-state handling.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {(['books', 'events', 'capacity', 'emails', 'registrations'] as DashboardTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab ? 'bg-brand-pink text-brand-navy' : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {tab === 'books' ? 'Books' : tab === 'events' ? 'Events' : tab === 'capacity' ? 'Capacity' : tab === 'emails' ? 'Emails' : 'Registrations'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void logout()}
                disabled={loggingOut}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60"
              >
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>

          {message ? <p className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
          {error ? <p className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}
        </div>

        {activeTab === 'books' ? (
          <div aria-label="Books editor" className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="rounded-[28px] border border-white/10 bg-white/10 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold font-outfit">Books</h2>
                <button
                  type="button"
                  onClick={addBook}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  Add book
                </button>
              </div>
              <p className="mb-3 text-xs text-white/60">Newest books stay at the top. Drag to reorder. This order also controls the homepage and books listing pages.</p>
              <div className="space-y-2">
                {visibleBooks.map((book) => {
                  const absoluteIndex = books.findIndex((candidate) => candidate.id === book.id);
                  return (
                  <button
                    key={String(book.id)}
                    type="button"
                    draggable
                    onClick={() => setSelectedBookId(book.id)}
                    onDragStart={() => setDraggedBookId(book.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggedBookId === null) {
                        return;
                      }

                      const fromIndex = books.findIndex((candidate) => candidate.id === draggedBookId);
                      moveBook(fromIndex, absoluteIndex);
                      setDraggedBookId(null);
                    }}
                    onDragEnd={() => setDraggedBookId(null)}
                    className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                      selectedBookId === book.id ? 'bg-brand-pink text-brand-navy' : 'bg-black/10 text-white/85 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{book.title}</div>
                        <div className="text-xs opacity-70">/{book.slug}</div>
                      </div>
                      <span className="text-xs opacity-60">#{absoluteIndex + 1}</span>
                    </div>
                  </button>
                );})}
              </div>
              {books.length > visibleBookCount ? (
                <button
                  type="button"
                  onClick={() => setVisibleBookCount((currentCount) => currentCount + 10)}
                  className="mt-3 w-full rounded-2xl border border-white/15 px-4 py-3 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  Load more books
                </button>
              ) : null}
            </aside>

            <div className="rounded-[28px] border border-white/10 bg-white/10 p-6">
              {selectedBook ? (
                <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Title (ZH)</span>
                  <input value={selectedBook.title} onChange={(event) => updateSelectedBook({ title: event.target.value })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Title (EN)</span>
                  <input value={selectedBook.titleEn || ''} onChange={(event) => updateSelectedBook({ titleEn: event.target.value })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Author (ZH)</span>
                  <input value={selectedBook.author} onChange={(event) => updateSelectedBook({ author: event.target.value })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Author (EN)</span>
                  <input value={selectedBook.authorEn || ''} onChange={(event) => updateSelectedBook({ authorEn: event.target.value })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Slug</span>
                  <input
                    value={selectedBook.slug}
                    onChange={(event) => {
                      updateSelectedBook({ slug: event.target.value });
                    }}
                    className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Read date</span>
                  <input value={selectedBook.readDate || ''} onChange={(event) => updateSelectedBook({ readDate: event.target.value })} placeholder="YYYY-MM-DD" className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold">Chinese cover</h3>
                    <label className="cursor-pointer rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10">
                      {uploadingAssetKey === 'book-cover-zh' ? 'Processing…' : 'Upload'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          void handleAction(async () => {
                            setUploadingAssetKey('book-cover-zh');
                            try {
                              const asset = await uploadAsset('books', file);
                              const nextBooks = buildBooksWithSelectedPatch({ coverUrl: asset.src, coverBlurDataURL: asset.blurDataURL });
                              setBooks(nextBooks);
                              await saveBooks(nextBooks, `Cover uploaded, optimized to ${asset.format || 'webp'}, and published.`);
                            } finally {
                              setUploadingAssetKey(null);
                            }
                          });
                        }}
                      />
                    </label>
                  </div>
                  <input value={selectedBook.coverUrl || ''} onChange={(event) => updateSelectedBook({ coverUrl: event.target.value })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold">English cover</h3>
                    <label className="cursor-pointer rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10">
                      {uploadingAssetKey === 'book-cover-en' ? 'Processing…' : 'Upload'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          void handleAction(async () => {
                            setUploadingAssetKey('book-cover-en');
                            try {
                              const asset = await uploadAsset('books', file);
                              const nextBooks = buildBooksWithSelectedPatch({ coverUrlEn: asset.src, coverBlurDataURLEn: asset.blurDataURL });
                              setBooks(nextBooks);
                              await saveBooks(nextBooks, `Cover uploaded, optimized to ${asset.format || 'webp'}, and published.`);
                            } finally {
                              setUploadingAssetKey(null);
                            }
                          });
                        }}
                      />
                    </label>
                  </div>
                  <input value={selectedBook.coverUrlEn || ''} onChange={(event) => updateSelectedBook({ coverUrlEn: event.target.value })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Extra covers (ZH, one per line)</span>
                  <textarea value={arrayToLines(selectedBook.coverUrls)} onChange={(event) => updateSelectedBook({ coverUrls: linesToArray(event.target.value) })} rows={4} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Extra covers (EN, one per line)</span>
                  <textarea value={arrayToLines(selectedBook.coverUrlsEn)} onChange={(event) => updateSelectedBook({ coverUrlsEn: linesToArray(event.target.value) })} rows={4} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Summary (ZH)</span>
                  <textarea value={selectedBook.summary || ''} onChange={(event) => updateSelectedBook({ summary: event.target.value })} rows={8} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Summary (EN)</span>
                  <textarea value={selectedBook.summaryEn || ''} onChange={(event) => updateSelectedBook({ summaryEn: event.target.value })} rows={8} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Reading notes (ZH)</span>
                  <textarea value={selectedBook.readingNotes || ''} onChange={(event) => updateSelectedBook({ readingNotes: event.target.value })} rows={10} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Reading notes (EN)</span>
                  <textarea value={selectedBook.readingNotesEn || ''} onChange={(event) => updateSelectedBook({ readingNotesEn: event.target.value })} rows={10} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Discussion points (ZH, one per line)</span>
                  <textarea value={arrayToLines(selectedBook.discussionPoints)} onChange={(event) => updateSelectedBook({ discussionPoints: linesToArray(event.target.value) })} rows={6} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Discussion points (EN, one per line)</span>
                  <textarea value={arrayToLines(selectedBook.discussionPointsEn)} onChange={(event) => updateSelectedBook({ discussionPointsEn: linesToArray(event.target.value) })} rows={6} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <label className="block md:col-span-1">
                  <span className="mb-2 block text-sm text-white/70">Tags</span>
                  <input value={tagsToInput(selectedBook.tags)} onChange={(event) => updateSelectedBook({ tags: inputToTags(event.target.value) })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block md:col-span-1">
                  <span className="mb-2 block text-sm text-white/70">Publisher link</span>
                  <input value={selectedBook.links?.publisher || ''} onChange={(event) => updateSelectedBook({ links: { ...selectedBook.links, publisher: event.target.value } })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block md:col-span-1">
                  <span className="mb-2 block text-sm text-white/70">Notes link</span>
                  <input value={selectedBook.links?.notes || ''} onChange={(event) => updateSelectedBook({ links: { ...selectedBook.links, notes: event.target.value } })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
              </div>

              <div className="mt-8">
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => void handleAction(saveBooks)} disabled={isPending} className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-3 font-semibold text-brand-navy transition hover:brightness-110 disabled:opacity-60">
                    {isPending ? 'Saving…' : 'Save books'}
                  </button>
                  <button type="button" onClick={deleteSelectedBook} disabled={isPending} className="inline-flex min-h-11 items-center rounded-full border border-rose-400/40 bg-rose-500/10 px-6 py-3 font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-60">
                    Delete book
                  </button>
                </div>
              </div>
                </>
              ) : (
                <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/10 text-center text-white/70">
                  <div>
                    <p className="text-lg font-semibold">No books yet</p>
                    <p className="mt-2 text-sm">Add a draft book to start building the list.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === 'events' ? (
          <div aria-label="Events editor" className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="rounded-[28px] border border-white/10 bg-white/10 p-4">
              <h2 className="mb-3 text-lg font-semibold font-outfit">Events</h2>
              <div className="space-y-2">
                {EVENT_IDS.map((eventId) => (
                  <button
                    key={eventId}
                    type="button"
                    onClick={() => setSelectedEventId(eventId)}
                    className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                      selectedEventId === eventId ? 'bg-brand-pink text-brand-navy' : 'bg-black/10 text-white/85 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-medium">{events[eventId].title.en}</div>
                    <div className="text-xs opacity-70">{eventId}</div>
                  </button>
                ))}
              </div>
            </aside>

            <div className="rounded-[28px] border border-white/10 bg-white/10 p-6">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-semibold">Poster asset</h3>
                  <label className="cursor-pointer rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10">
                    {uploadingAssetKey === 'event-poster' ? 'Processing…' : 'Upload poster'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        void handleAction(async () => {
                          setUploadingAssetKey('event-poster');
                          try {
                            const asset = await uploadAsset('events', file);
                            const nextEvents = {
                              ...events,
                              [selectedEventId]: {
                                ...selectedEvent,
                                posterSrc: asset.src,
                                posterBlurDataURL: asset.blurDataURL,
                              },
                            };
                            setEvents(nextEvents);
                            await saveEvents(nextEvents, `Poster uploaded, optimized to ${asset.format || 'webp'}, and published.`);
                          } finally {
                            setUploadingAssetKey(null);
                          }
                        });
                      }}
                    />
                  </label>
                </div>
                <input value={selectedEvent.posterSrc} onChange={(event) => updateEventField('posterSrc', event.target.value)} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Title (ZH)</span>
                  <input value={selectedEvent.title.zh} onChange={(event) => updateEventField('title', { ...selectedEvent.title, zh: event.target.value })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Title (EN)</span>
                  <input value={selectedEvent.title.en} onChange={(event) => updateEventField('title', { ...selectedEvent.title, en: event.target.value })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Poster alt (ZH)</span>
                  <input value={selectedEvent.posterAlt.zh} onChange={(event) => updateEventField('posterAlt', { ...selectedEvent.posterAlt, zh: event.target.value })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Poster alt (EN)</span>
                  <input value={selectedEvent.posterAlt.en} onChange={(event) => updateEventField('posterAlt', { ...selectedEvent.posterAlt, en: event.target.value })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Description (ZH)</span>
                  <textarea value={selectedEvent.description.zh} onChange={(event) => updateEventField('description', { ...selectedEvent.description, zh: event.target.value })} rows={10} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Description (EN)</span>
                  <textarea value={selectedEvent.description.en} onChange={(event) => updateEventField('description', { ...selectedEvent.description, en: event.target.value })} rows={10} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Location name (ZH)</span>
                  <input value={selectedEvent.locationName.zh} onChange={(event) => updateEventField('locationName', { ...selectedEvent.locationName, zh: event.target.value })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Location name (EN)</span>
                  <input value={selectedEvent.locationName.en} onChange={(event) => updateEventField('locationName', { ...selectedEvent.locationName, en: event.target.value })} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Signup path</span>
                  <input value={selectedEvent.signupPath} onChange={(event) => updateEventField('signupPath', event.target.value)} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Address country</span>
                  <input value={selectedEvent.addressCountry || ''} onChange={(event) => updateEventField('addressCountry', event.target.value || undefined)} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Image position</span>
                  <select value={selectedEvent.imagePosition} onChange={(event) => updateEventField('imagePosition', event.target.value as 'left' | 'right')} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40">
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Attendance mode</span>
                  <select value={selectedEvent.attendanceMode} onChange={(event) => updateEventField('attendanceMode', event.target.value as 'offline' | 'online')} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40">
                    <option value="offline">Offline</option>
                    <option value="online">Online</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <input type="checkbox" checked={selectedEvent.comingSoon === true} onChange={(event) => updateEventField('comingSoon', event.target.checked)} className="h-4 w-4 rounded border-white/20" />
                  <span className="text-sm text-white/85">Show coming soon state on signup page</span>
                </label>
              </div>

              {selectedEvent.comingSoon ? (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm text-white/70">Coming soon copy (ZH)</span>
                    <textarea value={selectedEvent.comingSoonBody?.zh || ''} onChange={(event) => updateEventField('comingSoonBody', { zh: event.target.value, en: selectedEvent.comingSoonBody?.en || '' })} rows={4} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm text-white/70">Coming soon copy (EN)</span>
                    <textarea value={selectedEvent.comingSoonBody?.en || ''} onChange={(event) => updateEventField('comingSoonBody', { zh: selectedEvent.comingSoonBody?.zh || '', en: event.target.value })} rows={4} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                  </label>
                </div>
              ) : null}

              <div className="mt-8">
                <button type="button" onClick={() => void handleAction(saveEvents)} disabled={isPending} className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-3 font-semibold text-brand-navy transition hover:brightness-110 disabled:opacity-60">
                  {isPending ? 'Saving…' : 'Save events'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'capacity' ? (
          <div aria-label="Capacity editor" className="rounded-[28px] border border-white/10 bg-white/10 p-6">
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-white/75 lg:flex-row lg:items-center lg:justify-between">
              <p>
                Live counts come from the shared registrations source of truth used by the public form. In persistent mode that is the Supabase registrations table; locally it falls back to the file-backed registrations store.
              </p>
              <p>{capacityStatusLoading ? 'Refreshing live counts…' : 'Live counts loaded.'}</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {CAPACITY_IDS.map((location) => {
                const slot = capacity[location];
                const liveStatus = capacityStatus[location];
                if (!slot) {
                  return null;
                }

                const configuredMax = typeof slot.max === 'number' ? slot.max : 0;
                const currentCount = liveStatus?.count ?? 0;
                const remaining = configuredMax > 0 ? Math.max(0, configuredMax - currentCount) : 0;

                return (
                  <div key={location} aria-label={`Capacity ${location}`} className="rounded-[24px] border border-white/10 bg-black/10 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-xl font-semibold font-outfit">{location}</h2>
                      <label className="flex items-center gap-2 text-sm text-white/80">
                        <input type="checkbox" checked={slot.enabled === true} onChange={(event) => updateCapacityField(location, 'enabled', event.target.checked)} />
                        Enabled
                      </label>
                    </div>

                    <div className="mb-4 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm md:grid-cols-3">
                      <div>
                        <p className="text-white/55">Successful signups</p>
                        <p className="mt-1 text-lg font-semibold">{currentCount}</p>
                      </div>
                      <div>
                        <p className="text-white/55">Remaining if saved now</p>
                        <p className="mt-1 text-lg font-semibold">{remaining}</p>
                      </div>
                      <div>
                        <p className="text-white/55">Live status</p>
                        <p className="mt-1 text-lg font-semibold">
                          {liveStatus?.enabled === false ? 'Disabled' : liveStatus?.reason === 'full' ? 'Full' : liveStatus?.reason === 'closed' ? 'Closed' : 'Open'}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm text-white/70">Start at</span>
                        <input type="datetime-local" value={toLocalDateTimeInput(slot.startAt)} onChange={(event) => updateCapacityField(location, 'startAt', toIsoString(event.target.value))} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm text-white/70">End at</span>
                        <input type="datetime-local" value={toLocalDateTimeInput(slot.endAt)} onChange={(event) => updateCapacityField(location, 'endAt', toIsoString(event.target.value))} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm text-white/70">Capacity</span>
                        <input type="number" min={1} value={slot.max || 1} onChange={(event) => updateCapacityField(location, 'max', Number(event.target.value) || 1)} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                        <input type="checkbox" checked={slot.forceFull === true} onChange={(event) => updateCapacityField(location, 'forceFull', event.target.checked)} />
                        <span className="text-sm text-white/85">Force full immediately</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8">
              <button type="button" onClick={() => void handleAction(saveCapacity)} disabled={isPending} className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-3 font-semibold text-brand-navy transition hover:brightness-110 disabled:opacity-60">
                {isPending ? 'Saving…' : 'Save capacity settings'}
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === 'emails' ? (
          <div aria-label="Registration email editor" className="rounded-[28px] border border-white/10 bg-white/10 p-6">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold font-outfit">Registration success emails</h2>
                  <p className="mt-2 max-w-3xl text-sm text-white/70">
                    When enabled, successful registrations will trigger a localized confirmation email through Resend or the configured local outbox transport.
                  </p>
                </div>
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={registrationEmails.enabled}
                    onChange={(event) => setRegistrationEmails((currentSettings) => ({ ...currentSettings, enabled: event.target.checked }))}
                  />
                  <span className="text-sm text-white/85">Send registration success emails automatically</span>
                </label>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-brand-navy/60 p-4 text-sm text-white/70">
                Supported tokens: <span className="font-mono text-white">{'{{name}}'}</span>, <span className="font-mono text-white">{'{{email}}'}</span>, <span className="font-mono text-white">{'{{location}}'}</span>, <span className="font-mono text-white">{'{{eventTitle}}'}</span>, <span className="font-mono text-white">{'{{siteUrl}}'}</span>
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
                <button type="button" onClick={() => void handleAction(saveRegistrationEmails)} disabled={isPending} className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-3 font-semibold text-brand-navy transition hover:brightness-110 disabled:opacity-60">
                  {isPending ? 'Saving…' : 'Save email settings'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'registrations' ? (
          <div aria-label="Registrations viewer" className="rounded-[28px] border border-white/10 bg-white/10 p-6">
            <div className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-black/10 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold font-outfit">Registrations audit</h2>
                  <p className="mt-2 max-w-3xl text-sm text-white/70">
                    This viewer reads from the app registration store used for capacity and confirmation flow. It does not query Notion directly. If Notion mirroring is enabled, rows with source <span className="font-mono text-white">notion</span> were mirrored successfully.
                  </p>
                </div>
                <button type="button" onClick={() => void refreshRegistrations()} disabled={registrationsLoading} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-60">
                  {registrationsLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Location</span>
                  <select value={registrationLocationFilter} onChange={(event) => setRegistrationLocationFilter(event.target.value as 'ALL' | SignupLocation)} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40">
                    <option value="ALL">All locations</option>
                    {CAPACITY_IDS.map((location) => <option key={location} value={location}>{location}</option>)}
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
                  <span className="mb-2 block text-sm text-white/70">Source</span>
                  <select value={registrationSourceFilter} onChange={(event) => setRegistrationSourceFilter(event.target.value as 'ALL' | RegistrationRecord['source'])} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40">
                    <option value="ALL">All sources</option>
                    {REGISTRATION_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Search</span>
                  <input value={registrationSearch} onChange={(event) => setRegistrationSearch(event.target.value)} placeholder="Name, email, profession" className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
              </div>

              {registrationsSummary ? (
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Total</p><p className="mt-1 text-2xl font-semibold">{registrationsSummary.total}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Confirmed</p><p className="mt-1 text-2xl font-semibold">{registrationsSummary.byStatus.confirmed}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Pending</p><p className="mt-1 text-2xl font-semibold">{registrationsSummary.byStatus.pending}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Mirrored to Notion</p><p className="mt-1 text-2xl font-semibold">{registrationsSummary.notionMirrored}</p></div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-brand-navy/50 p-4 text-sm text-white/70">
                Viewer source: <span className="font-mono text-white">{registrationsViewerSource}</span>. Notion mirror: <span className="font-mono text-white">{registrationsMirrorEnabled ? 'enabled' : 'disabled'}</span>.
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-white/5 text-left text-white/60">
                      <tr>
                        <th className="px-4 py-3 font-medium">Created</th>
                        <th className="px-4 py-3 font-medium">Location</th>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Source</th>
                        <th className="px-4 py-3 font-medium">Profession</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-black/10">
                      {registrations.map((registration) => (
                        <tr key={registration.id}>
                          <td className="px-4 py-3 text-white/75">{new Date(registration.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3 text-white">{registration.location}</td>
                          <td className="px-4 py-3 text-white">{registration.name}</td>
                          <td className="px-4 py-3 text-white/85">{registration.email}</td>
                          <td className="px-4 py-3"><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs uppercase tracking-wide text-white">{registration.status}</span></td>
                          <td className="px-4 py-3 text-white/85">{registration.source}</td>
                          <td className="px-4 py-3 text-white/75">{registration.profession}</td>
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
        ) : null}
      </div>
    </section>
  );
}