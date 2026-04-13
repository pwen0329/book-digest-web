'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { getBookSortOrder, getNextBookSortOrder, sortBooksDescending } from '@/lib/book-order';
import { getCanonicalBookCoverHints } from '@/lib/book-cover-strategy';
import type { Book, DraftBook } from '@/types/book';
import type { Event } from '@/types/event';
import type { Venue } from '@/types/venue';
import type { RegistrationEmailLocale, RegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';
import type { RegistrationAuditSummary, RegistrationRecord, RegistrationRecordStatus } from '@/lib/registration-store';
import VenueManager from '@/components/admin/VenueManager';
import EventManager from '@/components/admin/EventManager';

type AdminDashboardProps = {
  initialBooks: Book[];
  initialEvents: Event[];
  initialVenues: Venue[];
  initialRegistrationEmails: RegistrationSuccessEmailSettings;
};

type DashboardTab = 'books' | 'events' | 'venues' | 'emails' | 'registrations' | 'reconciliation' | 'assets';

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

type ReconciliationRow = {
  kind: 'matched' | 'missing_in_notion' | 'field_mismatch';
  sourceRecord: RegistrationRecord;
  notionRecord?: {
    id: string;
    registrationId: string;
    title: string;
    name: string;
    email: string;
    location: string;
    age: number | null;
    occupation: string;
    instagram: string;
    findingUs: string;
    findingUsOthers: string;
    visitorId: string;
    bankAccount: string;
    createdTime: string;
    lastEditedTime: string;
  };
  mismatchFields: string[];
};

type ReconciliationResponse = {
  summary: {
    notionConfigured: boolean;
    notionMirrorEnabled: boolean;
    totalSourceRecords: number;
    totalNotionRecords: number;
    matched: number;
    missingInNotion: number;
    missingInSource: number;
    mismatched: number;
    comparedAt: string;
  };
  rows: ReconciliationRow[];
  notionOnlyRows: Array<{
    kind: 'missing_in_source';
    notionRecord: {
      id: string;
      registrationId: string;
      title: string;
      name: string;
      email: string;
      location: string;
      age: number | null;
      occupation: string;
      instagram: string;
      findingUs: string;
      findingUsOthers: string;
      visitorId: string;
      bankAccount: string;
      createdTime: string;
      lastEditedTime: string;
    };
  }>;
};

type AssetReportResponse = {
  generatedAt: string;
  gracePeriodHours: number;
  referencedCount: number;
  storedCount: number;
  orphanedCount: number;
  missingReferencedCount: number;
  orphaned: Array<{ url: string; scope: 'books' | 'events'; fileName: string; storage: 'local' | 'supabase'; modifiedAt?: string }>;
  missingReferenced: Array<{ url: string; scope: 'books' | 'events'; fileName: string }>;
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

function createDraftBook(existingBooks: DraftBook[]): DraftBook {
  const nextOrder = getNextBookSortOrder(existingBooks as Book[]);
  const slugBase = `new-book-${nextOrder}`;
  const slug = existingBooks.some((book) => book.slug === slugBase)
    ? `new-book-${Date.now()}`
    : slugBase;

  return {
    id: undefined, // undefined = draft
    sortOrder: nextOrder,
    slug,
    title: `新書籍 ${nextOrder}`,
    titleEn: `New Book ${nextOrder}`,
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

export default function AdminDashboard({ initialBooks, initialEvents, initialVenues, initialRegistrationEmails }: AdminDashboardProps) {
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('books');
  const [books, setBooks] = useState<DraftBook[]>(() => sortBooksDescending(initialBooks));
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [venues, setVenues] = useState<Venue[]>(initialVenues);
  const [registrationEmails, setRegistrationEmails] = useState<RegistrationSuccessEmailSettings>(initialRegistrationEmails);
  const [selectedBookId, setSelectedBookId] = useState<number | undefined>(initialBooks[0]?.id);
  const [visibleBookCount, setVisibleBookCount] = useState(10);
  const [draggedBookId, setDraggedBookId] = useState<number | undefined>(undefined);
  const [uploadingAssetKey, setUploadingAssetKey] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [registrationsSummary, setRegistrationsSummary] = useState<RegistrationAuditSummary | null>(null);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationsViewerSource, setRegistrationsViewerSource] = useState<string>('registration-store');
  const [registrationsMirrorEnabled, setRegistrationsMirrorEnabled] = useState(false);
  const [registrationEventFilter, setRegistrationEventFilter] = useState<'ALL' | number>('ALL');
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState<'ALL' | RegistrationRecordStatus>('ALL');
  const [registrationSourceFilter, setRegistrationSourceFilter] = useState<'ALL' | RegistrationRecord['source']>('ALL');
  const [registrationSearch, setRegistrationSearch] = useState('');
  const [registrationCreatedAfter, setRegistrationCreatedAfter] = useState('');
  const [registrationCreatedBefore, setRegistrationCreatedBefore] = useState('');
  const [reconciliation, setReconciliation] = useState<ReconciliationResponse | null>(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [assetReport, setAssetReport] = useState<AssetReportResponse | null>(null);
  const [assetReportLoading, setAssetReportLoading] = useState(false);
  const [assetGracePeriodHours, setAssetGracePeriodHours] = useState('168');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [actionInFlight, setActionInFlight] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const selectedBookIndex = books.findIndex((book) => book.id === selectedBookId);
  const selectedBook = selectedBookIndex >= 0 ? books[selectedBookIndex] : books[0];
  const selectedBookCoverHints = selectedBook ? getCanonicalBookCoverHints(selectedBook) : null;
  const visibleBooks = useMemo(() => books.slice(0, visibleBookCount), [books, visibleBookCount]);

  useEffect(() => {
    if (!books.length) {
      if (selectedBookId !== null) {
        setSelectedBookId(undefined);
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

  function buildBooksWithSelectedPatch(patch: Partial<Book>): DraftBook[] {
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

  function normalizeLocalBookOrder(nextBooks: DraftBook[]): DraftBook[] {
    const maxOrder = nextBooks.length;
    return nextBooks.map((book, index) => ({
      ...book,
      sortOrder: maxOrder - index,
    }));
  }

  async function deleteSelectedBook() {
    if (!selectedBook) {
      return;
    }

    const confirmed = window.confirm(`Delete "${selectedBook.title}"? This removes it from the public site immediately.`);
    if (!confirmed) {
      return;
    }

    // If it's a draft (undefined ID), just remove it locally
    if (selectedBook.id === undefined) {
      const nextBooks = normalizeLocalBookOrder(books.filter((book) => book !== selectedBook));
      setBooks(nextBooks);
      setMessage('Draft book removed.');
      return;
    }

    // Delete from database
    const response = await fetch(`/api/admin/book-v2/${selectedBook.id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: 'Unable to delete book.' }));
      throw new Error(payload.error || 'Unable to delete book.');
    }

    // Reload books from database
    const listResponse = await fetch('/api/admin/books-v2');
    const listPayload = await listResponse.json().catch(() => ({ error: 'Unable to load books.' }));
    if (!listResponse.ok) {
      throw new Error(listPayload.error || 'Unable to load books.');
    }

    setBooks(sortBooksDescending(listPayload.books as Book[]));
    setMessage('Book deleted and public pages were revalidated.');
  }

  const refreshRegistrations = useCallback(async () => {
    setRegistrationsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (registrationEventFilter !== 'ALL') {
        params.set('eventId', String(registrationEventFilter));
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
      if (registrationCreatedAfter) {
        params.set('createdAfter', toIsoString(registrationCreatedAfter));
      }
      if (registrationCreatedBefore) {
        params.set('createdBefore', toIsoString(registrationCreatedBefore));
      }

      const response = await fetch(`/api/admin/registrations?${params.toString()}`, { cache: 'no-store' });
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
  }, [registrationCreatedAfter, registrationCreatedBefore, registrationEventFilter, registrationSearch, registrationSourceFilter, registrationStatusFilter]);

  const refreshReconciliation = useCallback(async () => {
    setReconciliationLoading(true);
    try {
      const response = await fetch('/api/admin/reconciliation?limit=500', { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as ReconciliationResponse | null;
      if (!response.ok || !payload) {
        throw new Error(payload && 'error' in payload ? String((payload as { error?: unknown }).error) : 'Unable to load reconciliation report.');
      }

      setReconciliation(payload);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load reconciliation report.');
    } finally {
      setReconciliationLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'reconciliation') {
      return;
    }

    void refreshReconciliation();
  }, [activeTab, refreshReconciliation]);

  const refreshAssetReport = useCallback(async () => {
    setAssetReportLoading(true);
    try {
      const response = await fetch(`/api/admin/assets?gracePeriodHours=${encodeURIComponent(assetGracePeriodHours)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as AssetReportResponse | null;
      if (!response.ok || !payload) {
        throw new Error(payload && 'error' in payload ? String((payload as { error?: unknown }).error) : 'Unable to load asset report.');
      }

      setAssetReport(payload);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load asset report.');
    } finally {
      setAssetReportLoading(false);
    }
  }, [assetGracePeriodHours]);

  useEffect(() => {
    if (activeTab !== 'assets') {
      return;
    }

    void refreshAssetReport();
  }, [activeTab, refreshAssetReport]);

  async function pruneOrphanedAssets() {
    const response = await fetch(`/api/admin/assets?gracePeriodHours=${encodeURIComponent(assetGracePeriodHours)}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({ error: 'Unable to prune orphaned assets.' }));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to prune orphaned assets.');
    }

    setMessage(`Deleted ${Array.isArray(payload.deleted) ? payload.deleted.length : 0} orphaned assets older than ${assetGracePeriodHours} hours.`);
    await refreshAssetReport();
  }

  async function downloadRegistrationsCsv() {
    const params = new URLSearchParams({ limit: '1000', format: 'csv' });
    if (registrationEventFilter !== 'ALL') {
      params.set('eventId', String(registrationEventFilter));
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
    if (registrationCreatedAfter) {
      params.set('createdAfter', toIsoString(registrationCreatedAfter));
    }
    if (registrationCreatedBefore) {
      params.set('createdBefore', toIsoString(registrationCreatedBefore));
    }

    const response = await fetch(`/api/admin/registrations?${params.toString()}`, { cache: 'no-store' });
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

  useEffect(() => {
    if (activeTab !== 'registrations') {
      return;
    }

    void refreshRegistrations();
  }, [activeTab, refreshRegistrations]);

  async function saveBooks(nextBooksOverride?: DraftBook[], successMessage = 'Books updated. Public pages were revalidated.') {
    resetFlash();

    const sourceBooks = nextBooksOverride || books;

    // Handle draft books (need to be created in database first)
    const draftBooks = sourceBooks.filter((book) => book.id === undefined);
    const existingBooks = sourceBooks.filter((book) => book.id !== undefined);

    // Create draft books in database
    for (const draftBook of draftBooks) {
      const payloadBook = {
        sortOrder: draftBook.sortOrder,
        slug: draftBook.slug,
        title: draftBook.title,
        titleEn: draftBook.titleEn,
        author: draftBook.author,
        authorEn: draftBook.authorEn,
        coverUrl: draftBook.coverUrl,
        coverUrlEn: draftBook.coverUrlEn,
        coverBlurDataURL: draftBook.coverBlurDataURL,
        coverBlurDataURLEn: draftBook.coverBlurDataURLEn,
        additionalCovers: draftBook.additionalCovers,
        readDate: draftBook.readDate,
        summary: draftBook.summary,
        summaryEn: draftBook.summaryEn,
        readingNotes: draftBook.readingNotes,
        readingNotesEn: draftBook.readingNotesEn,
        discussionPoints: draftBook.discussionPoints?.filter(Boolean),
        discussionPointsEn: draftBook.discussionPointsEn?.filter(Boolean),
        tags: draftBook.tags?.filter(Boolean),
        links: draftBook.links,
      };

      const response = await fetch('/api/admin/book-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBook),
      });

      const payload = await response.json().catch(() => ({ error: 'Unable to create book.' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to create book.');
      }
    }

    // Update existing books
    for (const book of existingBooks) {
      const payloadBook = {
        sortOrder: book.sortOrder,
        slug: book.slug,
        title: book.title,
        titleEn: book.titleEn,
        author: book.author,
        authorEn: book.authorEn,
        coverUrl: book.coverUrl,
        coverUrlEn: book.coverUrlEn,
        coverBlurDataURL: book.coverBlurDataURL,
        coverBlurDataURLEn: book.coverBlurDataURLEn,
        additionalCovers: book.additionalCovers,
        readDate: book.readDate,
        summary: book.summary,
        summaryEn: book.summaryEn,
        readingNotes: book.readingNotes,
        readingNotesEn: book.readingNotesEn,
        discussionPoints: book.discussionPoints?.filter(Boolean),
        discussionPointsEn: book.discussionPointsEn?.filter(Boolean),
        tags: book.tags?.filter(Boolean),
        links: book.links,
      };

      const response = await fetch(`/api/admin/book-v2/${book.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBook),
      });

      const payload = await response.json().catch(() => ({ error: 'Unable to update book.' }));
      if (!response.ok) {
        throw new Error(payload.error || `Unable to update book ${book.id}.`);
      }
    }

    // Reload books from database
    const listResponse = await fetch('/api/admin/books-v2');
    const listPayload = await listResponse.json().catch(() => ({ error: 'Unable to load books.' }));
    if (!listResponse.ok) {
      throw new Error(listPayload.error || 'Unable to load books.');
    }

    setBooks(sortBooksDescending(listPayload.books as Book[]));
    setMessage(successMessage);
  }

  async function saveRegistrationEmails() {
    resetFlash();

    // TODO: Implement PUT endpoint for saving email settings per event
    // Currently email settings are hardcoded in registration-success-email-config.ts
    setMessage('Email settings save not yet implemented. Coming soon.');
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
              {(['books', 'events', 'venues', 'emails', 'registrations', 'reconciliation', 'assets'] as DashboardTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab ? 'bg-brand-pink text-brand-navy' : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {tab === 'books' ? 'Books' : tab === 'events' ? 'Events' : tab === 'venues' ? 'Venues' : tab === 'emails' ? 'Emails' : tab === 'registrations' ? 'Registrations' : tab === 'reconciliation' ? 'Reconciliation' : 'Assets'}
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
                  const displayOrder = getBookSortOrder(book);
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
                      setDraggedBookId(undefined);
                    }}
                    onDragEnd={() => setDraggedBookId(undefined)}
                    className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                      selectedBookId === book.id ? 'bg-brand-pink text-brand-navy' : 'bg-black/10 text-white/85 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{book.title}</div>
                        <div className="text-xs opacity-70">/{book.slug}</div>
                      </div>
                      <span className="text-xs opacity-60">#{displayOrder}</span>
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
                  {selectedBookCoverHints ? <p className="mt-3 text-xs text-white/60">Canonical strategy: <span className="font-mono text-white">{selectedBookCoverHints.zh}</span></p> : null}
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
                  {selectedBookCoverHints ? <p className="mt-3 text-xs text-white/60">Canonical strategy: <span className="font-mono text-white">{selectedBookCoverHints.en}</span></p> : null}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Extra covers (ZH, one per line)</span>
                  <textarea value={arrayToLines(selectedBook.additionalCovers?.zh)} onChange={(event) => updateSelectedBook({ additionalCovers: { ...selectedBook.additionalCovers, zh: linesToArray(event.target.value) } })} rows={4} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Extra covers (EN, one per line)</span>
                  <textarea value={arrayToLines(selectedBook.additionalCovers?.en)} onChange={(event) => updateSelectedBook({ additionalCovers: { ...selectedBook.additionalCovers, en: linesToArray(event.target.value) } })} rows={4} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
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
                  <button type="button" onClick={() => void handleAction(saveBooks)} disabled={actionInFlight} className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-3 font-semibold text-brand-navy transition hover:brightness-110 disabled:opacity-60">
                    {actionInFlight ? 'Saving…' : 'Save books'}
                  </button>
                  <button type="button" onClick={() => void handleAction(deleteSelectedBook)} disabled={actionInFlight} className="inline-flex min-h-11 items-center rounded-full border border-rose-400/40 bg-rose-500/10 px-6 py-3 font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-60">
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
          <EventManager events={events} venues={venues} books={books.filter((book): book is Book => book.id !== undefined)} onEventsChange={setEvents} />
        ) : null}

        {activeTab === 'venues' ? (
          <VenueManager venues={venues} onVenuesChange={setVenues} />
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
                <button type="button" onClick={() => void handleAction(saveRegistrationEmails)} disabled={actionInFlight} className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-3 font-semibold text-brand-navy transition hover:brightness-110 disabled:opacity-60">
                  {actionInFlight ? 'Saving…' : 'Save email settings'}
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
                    This viewer reads from the app registration store used for capacity and confirmation flow. It supports CSV export, time-window filtering, and a per-row lifecycle trail including request id, mirror states, and delivery attempts.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => void handleAction(downloadRegistrationsCsv)} disabled={registrationsLoading || actionInFlight} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-60">
                    Export CSV
                  </button>
                  <button type="button" onClick={() => void refreshRegistrations()} disabled={registrationsLoading} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-60">
                    {registrationsLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
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
                <div className="grid gap-4 md:grid-cols-5">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Total</p><p className="mt-1 text-2xl font-semibold">{registrationsSummary.total}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Confirmed</p><p className="mt-1 text-2xl font-semibold">{registrationsSummary.byStatus.confirmed}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Pending</p><p className="mt-1 text-2xl font-semibold">{registrationsSummary.byStatus.pending}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Mirrored to Notion</p><p className="mt-1 text-2xl font-semibold">{registrationsSummary.notionMirrored}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Failed mirrors</p><p className="mt-1 text-2xl font-semibold">{registrationsSummary.failedMirrors}</p></div>
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
                        <th className="px-4 py-3 font-medium">Event</th>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Source</th>
                        <th className="px-4 py-3 font-medium">Profession</th>
                        <th className="px-4 py-3 font-medium">Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-black/10">
                      {registrations.map((registration) => (
                        <tr key={registration.id}>
                          <td className="px-4 py-3 text-white/75">{new Date(registration.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3 text-white">{events.find((e) => e.id === registration.eventId)?.title || `Event #${registration.eventId}`}</td>
                          <td className="px-4 py-3 text-white">{registration.name}</td>
                          <td className="px-4 py-3 text-white/85">{registration.email}</td>
                          <td className="px-4 py-3"><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs uppercase tracking-wide text-white">{registration.status}</span></td>
                          <td className="px-4 py-3 text-white/85">{registration.source}</td>
                          <td className="px-4 py-3 text-white/75">{registration.profession}</td>
                          <td className="px-4 py-3 text-white/75">
                            <details className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <summary className="cursor-pointer text-white">Details</summary>
                              <div className="mt-3 space-y-2 text-xs text-white/70">
                                <p>Request ID: <span className="font-mono text-white">{registration.requestId || 'n/a'}</span></p>
                                <p>Visitor ID: <span className="font-mono text-white">{registration.visitorId || 'n/a'}</span></p>
                                <p>Bank account: <span className="font-mono text-white">{registration.bankAccount || 'n/a'}</span></p>
                                <p>External ID: <span className="font-mono text-white">{registration.externalId || 'n/a'}</span></p>
                                <p>Notion: <span className="font-mono text-white">{registration.mirrorState?.notion?.status || 'n/a'}</span></p>
                                <p>Tally: <span className="font-mono text-white">{registration.mirrorState?.tally?.status || 'n/a'}</span></p>
                                <p>Email: <span className="font-mono text-white">{registration.mirrorState?.email?.status || 'n/a'}</span></p>
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                  <p className="mb-2 text-white/85">Audit trail</p>
                                  <div className="space-y-2">
                                    {(registration.auditTrail || []).map((entry) => (
                                      <div key={`${registration.id}-${entry.at}-${entry.event}`} className="rounded-xl border border-white/10 bg-white/5 p-2">
                                        <p className="text-white">{entry.event}</p>
                                        <p>{new Date(entry.at).toLocaleString()} by {entry.actor}</p>
                                        <p>{entry.summary}</p>
                                      </div>
                                    ))}
                                    {!registration.auditTrail?.length ? <p>No audit entries recorded.</p> : null}
                                  </div>
                                </div>
                              </div>
                            </details>
                          </td>
                        </tr>
                      ))}
                      {!registrations.length ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-white/60">No registrations matched the current filters.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'reconciliation' ? (
          <div aria-label="Reconciliation viewer" className="rounded-[28px] border border-white/10 bg-white/10 p-6">
            <div className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-black/10 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold font-outfit">Notion vs source-of-truth reconciliation</h2>
                  <p className="mt-2 max-w-3xl text-sm text-white/70">
                    This page compares the app registration store against the optional Notion mirror and highlights where the mirror is missing, where fields drifted, and where Notion contains rows the app does not know about.
                  </p>
                </div>
                <button type="button" onClick={() => void refreshReconciliation()} disabled={reconciliationLoading} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-60">
                  {reconciliationLoading ? 'Refreshing…' : 'Refresh reconciliation'}
                </button>
              </div>

              {reconciliation ? (
                <>
                  <div className="grid gap-4 md:grid-cols-6">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Matched</p><p className="mt-1 text-2xl font-semibold">{reconciliation.summary.matched}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Missing in Notion</p><p className="mt-1 text-2xl font-semibold">{reconciliation.summary.missingInNotion}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Field drift</p><p className="mt-1 text-2xl font-semibold">{reconciliation.summary.mismatched}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Notion only</p><p className="mt-1 text-2xl font-semibold">{reconciliation.summary.missingInSource}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Mirror enabled</p><p className="mt-1 text-sm font-semibold">{reconciliation.summary.notionMirrorEnabled ? 'enabled' : 'disabled'}</p></div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-brand-navy/50 p-4 text-sm text-white/70">
                    Compared at {new Date(reconciliation.summary.comparedAt).toLocaleString()}. Notion configured: <span className="font-mono text-white">{reconciliation.summary.notionConfigured ? 'yes' : 'no'}</span>.
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <h3 className="text-lg font-semibold font-outfit">Source rows with drift</h3>
                      <div className="mt-4 space-y-3">
                        {reconciliation.rows.filter((row) => row.kind !== 'matched').map((row) => (
                          <div key={row.sourceRecord.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="font-semibold text-white">{row.sourceRecord.name}</p>
                              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs uppercase tracking-wide text-white">{row.kind}</span>
                            </div>
                            <p className="mt-2">{row.sourceRecord.email} · Event #{row.sourceRecord.eventId}</p>
                            <p className="mt-2">Request ID: <span className="font-mono text-white">{row.sourceRecord.requestId || 'n/a'}</span></p>
                            {row.mismatchFields.length ? <p className="mt-2">Mismatched fields: <span className="font-mono text-white">{row.mismatchFields.join(', ')}</span></p> : null}
                            {row.notionRecord ? <p className="mt-2">Notion page: <span className="font-mono text-white">{row.notionRecord.id}</span></p> : null}
                          </div>
                        ))}
                        {!reconciliation.rows.some((row) => row.kind !== 'matched') ? <p className="text-sm text-white/60">No reconciliation differences found.</p> : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <h3 className="text-lg font-semibold font-outfit">Notion-only rows</h3>
                      <div className="mt-4 space-y-3">
                        {reconciliation.notionOnlyRows.map((row) => (
                          <div key={row.notionRecord.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="font-semibold text-white">{row.notionRecord.name || row.notionRecord.title}</p>
                              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs uppercase tracking-wide text-white">missing_in_source</span>
                            </div>
                            <p className="mt-2">{row.notionRecord.email} · {row.notionRecord.location}</p>
                            <p className="mt-2">Registration ID: <span className="font-mono text-white">{row.notionRecord.registrationId || 'n/a'}</span></p>
                            <p className="mt-2">Notion page: <span className="font-mono text-white">{row.notionRecord.id}</span></p>
                          </div>
                        ))}
                        {!reconciliation.notionOnlyRows.length ? <p className="text-sm text-white/60">No Notion-only rows found.</p> : null}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-white/60">No reconciliation report loaded yet.</p>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === 'assets' ? (
          <div aria-label="Assets viewer" className="rounded-[28px] border border-white/10 bg-white/10 p-6">
            <div className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-black/10 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold font-outfit">Admin asset scan and cleanup</h2>
                  <p className="mt-2 max-w-3xl text-sm text-white/70">
                    The asset manager compares referenced admin images against the actual storage bucket or local upload directory, then prunes only orphaned files older than the configured grace period.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => void refreshAssetReport()} disabled={assetReportLoading} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-60">
                    {assetReportLoading ? 'Scanning…' : 'Scan assets'}
                  </button>
                  <button type="button" onClick={() => void handleAction(pruneOrphanedAssets)} disabled={assetReportLoading || actionInFlight} className="inline-flex min-h-11 items-center rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-60">
                    Prune old orphans
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">Grace period hours</span>
                  <input value={assetGracePeriodHours} onChange={(event) => setAssetGracePeriodHours(event.target.value.replace(/[^0-9]/g, '') || '168')} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
                </label>
                <div className="rounded-2xl border border-white/10 bg-brand-navy/50 p-4 text-sm text-white/70">
                  Recommended policy: keep a 7-day grace period so uploads that were processed but not yet referenced by a saved document do not get deleted by the cleanup pass.
                </div>
              </div>

              {assetReport ? (
                <>
                  <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Referenced</p><p className="mt-1 text-2xl font-semibold">{assetReport.referencedCount}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Stored</p><p className="mt-1 text-2xl font-semibold">{assetReport.storedCount}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Orphaned</p><p className="mt-1 text-2xl font-semibold">{assetReport.orphanedCount}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Missing referenced</p><p className="mt-1 text-2xl font-semibold">{assetReport.missingReferencedCount}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Generated</p><p className="mt-1 text-sm font-semibold">{new Date(assetReport.generatedAt).toLocaleString()}</p></div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <h3 className="text-lg font-semibold font-outfit">Orphaned assets</h3>
                      <div className="mt-4 space-y-3">
                        {assetReport.orphaned.map((asset) => (
                          <div key={asset.url} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
                            <p className="font-mono text-white">{asset.fileName}</p>
                            <p className="mt-2">{asset.scope} · {asset.storage}</p>
                            <p className="mt-2 break-all">{asset.url}</p>
                            <p className="mt-2">Modified: {asset.modifiedAt ? new Date(asset.modifiedAt).toLocaleString() : 'unknown'}</p>
                          </div>
                        ))}
                        {!assetReport.orphaned.length ? <p className="text-sm text-white/60">No orphaned assets detected.</p> : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <h3 className="text-lg font-semibold font-outfit">Referenced but missing in storage</h3>
                      <div className="mt-4 space-y-3">
                        {assetReport.missingReferenced.map((asset) => (
                          <div key={asset.url} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
                            <p className="font-mono text-white">{asset.fileName}</p>
                            <p className="mt-2">{asset.scope}</p>
                            <p className="mt-2 break-all">{asset.url}</p>
                          </div>
                        ))}
                        {!assetReport.missingReferenced.length ? <p className="text-sm text-white/60">No missing referenced assets detected.</p> : null}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-white/60">No asset report loaded yet.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}