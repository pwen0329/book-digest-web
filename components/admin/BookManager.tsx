'use client';

import { useEffect, useMemo, useState } from 'react';
import { getBookSortOrder, getNextBookSortOrder, sortBooksDescending } from '@/lib/book-order';
import { getCanonicalBookCoverHints } from '@/lib/book-cover-strategy';
import type { Book, DraftBook } from '@/types/book';

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

type UploadedAsset = {
  src: string;
  width?: number;
  height?: number;
  format?: string;
  blurDataURL?: string;
};

async function uploadAsset(scope: 'books' | 'events', file: File): Promise<UploadedAsset> {
  const formData = new FormData();
  formData.set('file', file);

  const response = await fetch(`/api/admin/upload?scope=${scope}`, {
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

function normalizeLocalBookOrder(nextBooks: DraftBook[]): DraftBook[] {
  const maxOrder = nextBooks.length;
  return nextBooks.map((book, index) => ({
    ...book,
    sortOrder: maxOrder - index,
  }));
}

type BookManagerProps = {
  initialBooks: Book[];
};

export default function BookManager({ initialBooks }: BookManagerProps) {
  const [books, setBooks] = useState<DraftBook[]>(sortBooksDescending(initialBooks));
  const [selectedBookId, setSelectedBookId] = useState<number | undefined>(initialBooks[0]?.id);
  const [visibleBookCount, setVisibleBookCount] = useState(10);
  const [draggedBookId, setDraggedBookId] = useState<number | undefined>(undefined);
  const [uploadingAssetKey, setUploadingAssetKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);

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
      credentials: 'include',
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: 'Unable to delete book.' }));
      throw new Error(payload.error || 'Unable to delete book.');
    }

    // Reload books from database
    const listResponse = await fetch('/api/admin/books-v2', {
      credentials: 'include',
    });
    const listPayload = await listResponse.json().catch(() => ({ error: 'Unable to load books.' }));
    if (!listResponse.ok) {
      throw new Error(listPayload.error || 'Unable to load books.');
    }

    setBooks(sortBooksDescending(listPayload.books as Book[]));
    setMessage('Book deleted and public pages were revalidated.');
  }

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
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payloadBook),
      });

      const payload = await response.json().catch(() => ({ error: 'Unable to update book.' }));
      if (!response.ok) {
        throw new Error(payload.error || `Unable to update book ${book.id}.`);
      }
    }

    // Reload books from database
    const listResponse = await fetch('/api/admin/books-v2', {
      credentials: 'include',
    });
    const listPayload = await listResponse.json().catch(() => ({ error: 'Unable to load books.' }));
    if (!listResponse.ok) {
      throw new Error(listPayload.error || 'Unable to load books.');
    }

    setBooks(sortBooksDescending(listPayload.books as Book[]));
    setMessage(successMessage);
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
    setMessage('Draft book added. Fill in the fields and save books to publish it.');
    setError(null);
  }

  return (
    <>
      {message ? <div className="rounded-[28px] border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">{message}</div> : null}
      {error ? <div className="rounded-[28px] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

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
    </>
  );
}
