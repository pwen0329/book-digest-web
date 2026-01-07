'use client';
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BLUR_BOOK_CAROUSEL } from '@/lib/constants';

type Book = {
  id: string | number;
  slug: string;
  title: string;
  author: string;
  coverUrl?: string;
  readDate?: string;
};

type BookCarouselProps = {
  books: Book[];
  visibleCount?: number;
  autoPlay?: boolean;
  interval?: number;
};

// Use memo to optimize book card, avoid unnecessary re-renders
const BookCard = memo(function BookCard({ 
  book, 
  idx 
}: { 
  book: Book; 
  idx: number;
}) {
  return (
    <Link
      href={`/books/${book.slug}`}
      className="group block"
      prefetch={false}
    >
      <div className="relative aspect-[2/3] w-24 sm:w-28 md:w-32 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-xl">
        <Image
          src={book.coverUrl || '/images/placeholder-cover.svg'}
          alt={book.title}
          fill
          sizes="(max-width: 640px) 96px, (max-width: 768px) 112px, 128px"
          className="object-cover"
          loading={idx < 3 ? 'eager' : 'lazy'}
          placeholder="blur"
          blurDataURL={BLUR_BOOK_CAROUSEL}
        />
      </div>
      <div className="mt-2 text-center">
        <p className="text-xs text-white/70 truncate max-w-[8rem]">
          {book.title}
        </p>
      </div>
    </Link>
  );
});

export default function BookCarousel({
  books,
  visibleCount = 5,
  autoPlay = true,
  interval = 4000,
}: BookCarouselProps) {
  // Cache sorted results with useMemo, avoid re-sorting on each render
  const sortedBooks = useMemo(() => 
    [...books].sort((a, b) => {
      if (!a.readDate && !b.readDate) return 0;
      if (!a.readDate) return 1;
      if (!b.readDate) return -1;
      return new Date(b.readDate).getTime() - new Date(a.readDate).getTime();
    }),
    [books]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Cache reduceMotion check with useMemo
  const reduceMotion = useMemo(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const maxIndex = useMemo(() => 
    Math.max(0, sortedBooks.length - visibleCount),
    [sortedBooks.length, visibleCount]
  );

  const goToNext = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    setTimeout(() => setIsTransitioning(false), 500);
  }, [maxIndex, isTransitioning]);

  const goToPrev = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
    setTimeout(() => setIsTransitioning(false), 500);
  }, [maxIndex, isTransitioning]);

  useEffect(() => {
    if (!autoPlay || reduceMotion || sortedBooks.length <= visibleCount) return;

    const timer = setInterval(goToNext, interval);
    return () => clearInterval(timer);
  }, [autoPlay, interval, goToNext, reduceMotion, sortedBooks.length, visibleCount]);

  // Cache visible books list with useMemo
  const visibleBooks = useMemo(() => {
    const visible = sortedBooks.slice(currentIndex, currentIndex + visibleCount);
    // Fill remaining slots if needed
    while (visible.length < visibleCount && sortedBooks.length > 0) {
      visible.push(sortedBooks[visible.length % sortedBooks.length]);
    }
    return visible;
  }, [sortedBooks, currentIndex, visibleCount]);

  return (
    <section aria-labelledby="book-carousel-heading" className="bg-brand-navy">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-end justify-between gap-4 mb-8">
          <h2
            id="book-carousel-heading"
            className="text-2xl md:text-3xl font-bold tracking-wide text-white"
          >
            Recent Reads
          </h2>
          <Link
            href="/books"
            className="text-sm font-semibold text-brand-pink hover:underline uppercase tracking-wider font-outfit"
          >
            View All
          </Link>
        </div>

        {/* Carousel Container */}
        <div className="relative">
          {/* Navigation Arrows */}
          {sortedBooks.length > visibleCount && (
            <>
              <button
                onClick={goToPrev}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink"
                aria-label="Previous books"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink"
                aria-label="Next books"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Books Grid - Centered with offset to the right */}
          <div className="flex justify-center md:justify-end md:pr-8">
            <div
              className={`grid gap-4 transition-transform duration-500 ease-out ${
                visibleCount === 5
                  ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'
                  : `grid-cols-${Math.min(visibleCount, 3)} sm:grid-cols-${Math.min(visibleCount, 4)} md:grid-cols-${visibleCount}`
              }`}
            >
              {visibleBooks.map((book, idx) => (
                <BookCard key={`${book.id}-${idx}`} book={book} idx={idx} />
              ))}
            </div>
          </div>
        </div>

        {/* Pagination Dots */}
        {sortedBooks.length > visibleCount && (
          <div className="flex justify-center gap-1.5 mt-6">
            {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (!isTransitioning) {
                    setIsTransitioning(true);
                    setCurrentIndex(idx);
                    setTimeout(() => setIsTransitioning(false), 500);
                  }
                }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx === currentIndex
                    ? 'bg-brand-pink w-6'
                    : 'bg-white/30 hover:bg-white/50'
                }`}
                aria-label={`Go to page ${idx + 1}`}
                aria-current={idx === currentIndex ? 'page' : undefined}
              />
            ))}
          </div>
        )}

        {/* Mobile View All Button */}
        <div className="mt-6 text-center md:hidden">
          <Link
            href="/books"
            className="inline-flex items-center rounded-full bg-brand-pink px-5 py-2.5 font-semibold text-white uppercase tracking-wider text-sm font-outfit hover:brightness-110 transition-all"
          >
            Browse Books
          </Link>
        </div>
      </div>
    </section>
  );
}
