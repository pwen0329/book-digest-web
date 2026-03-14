'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { Book } from '@/types/book';
import type { EventContentId, EventContentMap } from '@/types/event-content';
import type { RegistrationEmailLocale, RegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';
import type { CapacityConfigFile, SignupLocation } from '@/lib/signup-capacity-config';

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

type DashboardTab = 'books' | 'events' | 'capacity' | 'emails';

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
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [events, setEvents] = useState<EventContentMap>(initialEvents);
  const [capacity, setCapacity] = useState<CapacityConfigFile>(initialCapacity);
  const [registrationEmails, setRegistrationEmails] = useState<RegistrationSuccessEmailSettings>(initialRegistrationEmails);
  const [documentVersions, setDocumentVersions] = useState(initialDocumentVersions);
  const [capacityStatus, setCapacityStatus] = useState<Partial<Record<SignupLocation, CapacityLiveStatus>>>({});
  const [capacityStatusLoading, setCapacityStatusLoading] = useState(false);
  const [selectedBookSlug, setSelectedBookSlug] = useState(initialBooks[0]?.slug || '');
  const [visibleBookCount, setVisibleBookCount] = useState(10);
  const [draggedBookSlug, setDraggedBookSlug] = useState<string | null>(null);
  const [uploadingAssetKey, setUploadingAssetKey] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<EventContentId>('TW');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setHydrated(true);
  }, []);

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

  const selectedBookIndex = books.findIndex((book) => book.slug === selectedBookSlug);
  const selectedBook = selectedBookIndex >= 0 ? books[selectedBookIndex] : books[0];
  const visibleBooks = useMemo(() => books.slice(0, visibleBookCount), [books, visibleBookCount]);

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
      return nextBooks;
    });
    setMessage('Book order updated locally. Save books to publish the new order.');
    setError(null);
  }

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
      body: JSON.stringify({ books: payloadBooks, expectedUpdatedAt: documentVersions.books }),
    });

    const payload = await response.json().catch(() => ({ error: 'Unable to save books.' }));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to save books.');
    }

    setBooks(payload.books as Book[]);
    setDocumentVersions((currentVersions) => ({ ...currentVersions, books: (payload.updatedAt as string | null | undefined) ?? currentVersions.books }));
    setMessage(successMessage);
  }

  async function saveEvents(nextEventsOverride?: EventContentMap, successMessage = 'Event content and posters updated. Public event pages were revalidated.') {
    resetFlash();

    const response = await fetch('/api/admin/events', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: nextEventsOverride || events, expectedUpdatedAt: documentVersions.events }),
    });

    const payload = await response.json().catch(() => ({ error: 'Unable to save events.' }));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to save events.');
    }

    setEvents(payload.events as EventContentMap);
    setDocumentVersions((currentVersions) => ({ ...currentVersions, events: (payload.updatedAt as string | null | undefined) ?? currentVersions.events }));
    setMessage(successMessage);
  }

  async function saveCapacity() {
    resetFlash();

    const response = await fetch('/api/admin/capacity', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity, expectedUpdatedAt: documentVersions.capacity }),
    });

    const payload = await response.json().catch(() => ({ error: 'Unable to save capacity settings.' }));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to save capacity settings.');
    }

    setCapacity(payload.capacity as CapacityConfigFile);
    setDocumentVersions((currentVersions) => ({ ...currentVersions, capacity: (payload.updatedAt as string | null | undefined) ?? currentVersions.capacity }));
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
      body: JSON.stringify({ settings: registrationEmails, expectedUpdatedAt: documentVersions.emails }),
    });

    const payload = await response.json().catch(() => ({ error: 'Unable to save registration email settings.' }));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to save registration email settings.');
    }

    setRegistrationEmails(payload.settings as RegistrationSuccessEmailSettings);
    setDocumentVersions((currentVersions) => ({ ...currentVersions, emails: (payload.updatedAt as string | null | undefined) ?? currentVersions.emails }));
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
    setBooks((currentBooks) => [draft, ...currentBooks]);
    setSelectedBookSlug(draft.slug);
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
              {(['books', 'events', 'capacity', 'emails'] as DashboardTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab ? 'bg-brand-pink text-brand-navy' : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {tab === 'books' ? 'Books' : tab === 'events' ? 'Events' : tab === 'capacity' ? 'Capacity' : 'Emails'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void logout()}
                disabled={loggingOut}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
              >
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>

          {message ? <p className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
          {error ? <p className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}
        </div>

        {activeTab === 'books' && selectedBook ? (
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
                  const absoluteIndex = books.findIndex((candidate) => candidate.slug === book.slug);
                  return (
                  <button
                    key={book.slug}
                    type="button"
                    draggable
                    onClick={() => setSelectedBookSlug(book.slug)}
                    onDragStart={() => setDraggedBookSlug(book.slug)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!draggedBookSlug) {
                        return;
                      }

                      const fromIndex = books.findIndex((candidate) => candidate.slug === draggedBookSlug);
                      moveBook(fromIndex, absoluteIndex);
                      setDraggedBookSlug(null);
                    }}
                    onDragEnd={() => setDraggedBookSlug(null)}
                    className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                      selectedBookSlug === book.slug ? 'bg-brand-pink text-brand-navy' : 'bg-black/10 text-white/85 hover:bg-white/10'
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
                      const nextSlug = event.target.value;
                      updateSelectedBook({ slug: nextSlug });
                      setSelectedBookSlug(nextSlug);
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
                              const nextBooks = buildBooksWithSelectedPatch({ coverUrl: asset.src });
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
                              const nextBooks = buildBooksWithSelectedPatch({ coverUrlEn: asset.src });
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
                <button type="button" onClick={() => void handleAction(saveBooks)} disabled={isPending} className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-3 font-semibold text-brand-navy transition hover:brightness-110 disabled:opacity-60">
                  {isPending ? 'Saving…' : 'Save books'}
                </button>
              </div>
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
                Live counts come from the signup capacity store used by the public form: Upstash Redis when configured, otherwise the local in-memory fallback. They are not read from a registrations database table.
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
      </div>
    </section>
  );
}