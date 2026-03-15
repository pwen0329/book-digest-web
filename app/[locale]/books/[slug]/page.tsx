import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { getTranslations } from 'next-intl/server';
import { getBooks, getLocalizedBook, getBookBySlug } from '@/lib/books';
import { BLUR_BOOK_COVER_LARGE } from '@/lib/constants';
import { locales, setRequestLocale } from '@/lib/i18n';
import { getLocaleAlternates } from '@/lib/seo';

// ISR: regenerate book pages hourly without a full rebuild
export const revalidate = 3600;

// Dynamically load sidebar (non-critical above-the-fold content)
const BookArticleSidebar = dynamic(() => import('@/components/BookArticleSidebar'), {
  loading: () => (
    <div className="space-y-6">
      <div className="animate-pulse bg-gray-200 rounded-2xl h-40" />
      <div className="animate-pulse bg-gray-200 rounded-2xl h-48" />
      <div className="animate-pulse bg-gray-200 rounded-2xl h-32" />
    </div>
  ),
});

// Generate static paths for all books and locales (SSG optimization)
export async function generateStaticParams() {
  const books = await getBooks();
  return books.flatMap((book) => 
    locales.map((locale) => ({
      locale,
      slug: book.slug,
    }))
  );
}

// Generate Metadata (SEO optimization)
export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  const rawBook = await getBookBySlug(slug);
  
  if (!rawBook) {
    return { title: 'Book Not Found' };
  }
  
  const book = getLocalizedBook(rawBook, locale);
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bookdigest.club';
  const ogImageUrl = `${siteUrl}/api/og?title=${encodeURIComponent(book.displayTitle)}&author=${encodeURIComponent(book.displayAuthor)}&cover=${encodeURIComponent(book.displayCoverUrl || book.coverUrl || '')}&locale=${locale}`;
  
  return {
    title: `${book.displayTitle} | Book Digest`,
    description: book.displaySummary?.slice(0, 160) || `Read our notes on ${book.displayTitle} by ${book.displayAuthor}`,
    openGraph: {
      type: 'article',
      title: book.displayTitle,
      description: book.displaySummary?.slice(0, 160),
      locale: locale === 'zh' ? 'zh_TW' : 'en_US',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: book.displayTitle }],
      ...(rawBook.readDate && { publishedTime: rawBook.readDate }),
      section: 'Books',
      authors: [book.displayAuthor],
    },
    twitter: {
      card: 'summary_large_image',
      title: book.displayTitle,
      images: [ogImageUrl],
    },
    alternates: getLocaleAlternates(`books/${slug}`, locale),
  };
}

export default async function BookArticlePage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  // Get params first
  const { slug, locale } = await params;
  
  // Enable static rendering BEFORE any getTranslations call
  setRequestLocale(locale);

  // Now safe to use getTranslations
  const t = await getTranslations('books');

  const allBooks = await getBooks();
  const rawBook = await getBookBySlug(slug);
  if (!rawBook) return notFound();
  
  const book = getLocalizedBook(rawBook, locale);

  // JSON-LD structured data for Book schema
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bookdigest.club';
  const bookJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.displayTitle,
    author: { '@type': 'Person', name: book.displayAuthor },
    ...(book.displayCoverUrl && { image: `${siteUrl}${book.displayCoverUrl}` }),
    ...(book.displaySummary && { description: book.displaySummary.slice(0, 300) }),
    url: `${siteUrl}/${locale}/books/${slug}`,
    inLanguage: locale === 'en' ? 'en' : 'zh-TW',
    ...(book.readDate && { datePublished: book.readDate }),
    ...(book.tags && book.tags.length > 0 && { genre: book.tags }),
    publisher: {
      '@type': 'Organization',
      name: 'Book Digest',
      url: siteUrl,
    },
  };

  // Get other articles for sidebar (exclude current)
  const otherArticles = allBooks
    .filter((b) => b.slug !== slug)
    .slice(0, 5)
    .map((b) => ({ 
      slug: b.slug, 
      title: locale === 'en' && b.titleEn ? b.titleEn : b.title 
    }));

  return (
    <article className="bg-white min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd).replace(/<\/script>/gi, '<\\/script>') }}
      />
      {/* Hero Section */}
      <header className="relative bg-gradient-to-b from-brand-navy to-brand-blue">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-14 md:pt-12 md:pb-20">
          <div className="grid max-w-6xl gap-8 md:grid-cols-[224px_minmax(0,1fr)] md:items-start lg:grid-cols-[256px_minmax(0,1fr)]">
            {/* Book Cover - Optimized image loading */}
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory hide-scrollbar md:block md:overflow-visible md:pb-0">
              {(book.displayCoverUrls && book.displayCoverUrls.length > 0
                ? book.displayCoverUrls
                : [book.displayCoverUrl || book.coverUrl || '/images/placeholder-cover.svg']
              ).map((url, idx) => (
                <div key={idx} className="relative w-48 md:w-56 aspect-[2/3] flex-shrink-0 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/20 snap-center">
                  <Image
                    src={url}
                    alt={`${book.displayTitle} - Cover ${idx + 1}`}
                    fill
                    sizes="(max-width: 768px) 192px, 224px"
                    className="object-cover"
                    priority={idx === 0}
                    placeholder="blur"
                    blurDataURL={book.displayCoverBlurDataURL || BLUR_BOOK_COVER_LARGE}
                  />
                </div>
              ))}
            </div>

            {/* Book Info */}
            <div className="max-w-2xl text-left text-white">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold leading-tight">
                {book.displayTitle}
              </h1>
              <p className="mt-3 text-lg md:text-xl text-white/80">
                {t('byAuthor')} {book.displayAuthor}
              </p>
              {book.tags && book.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 justify-start">
                  {book.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block px-3 py-1 text-sm bg-white/10 rounded-full text-white/90"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              {book.readDate && (
                <p className="mt-4 text-sm text-white/60">
                  {t('bookClubDate')}{new Date(book.readDate).toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-TW', {
                    year: 'numeric',
                    month: 'long',
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - clean white background */}
      <div className="mx-auto max-w-6xl py-8 px-3 sm:px-6">
        <div className="bg-white rounded-2xl p-4 sm:p-6 md:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Article Content */}
            <main className="lg:col-span-2 space-y-8">
              {/* Summary Section */}
              <section className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">📖 {t('summary')}</h2>
                <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-line">
                  {book.displaySummary || (locale === 'en' ? 'This book offers profound insights and inspiration...' : '這本書帶給我們許多深刻的思考與啟發...')}
                </p>
              </section>

              {/* Reading Notes */}
              <section className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">✍️ {t('readingNotes')}</h2>
                {((locale === 'en' && book.readingNotesEn) || (locale !== 'en' && book.readingNotes)) ? (
                  <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-line">
                    {locale === 'en' ? book.readingNotesEn : book.readingNotes}
                  </p>
                ) : (
                  <>
                    <p className="text-gray-600 italic">
                      {t('notesComingSoon')}
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                      {t('notesNotice')}
                    </p>
                    <Link
                      href={`/${locale}/events`}
                      className={`inline-flex items-center mt-4 px-4 py-2 bg-brand-pink text-white font-semibold rounded-full hover:brightness-110 transition-all ${locale === 'zh' ? 'tracking-widest' : ''}`}
                      prefetch={false}
                    >
                      {t('signUp')}
                    </Link>
                  </>
                )}
              </section>

              {/* Discussion Points */}
              <section className="bg-gray-50 rounded-xl p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">💬 {t('discussionPoints')}</h2>
                <ul className="space-y-3">
                  {(locale === 'en' ? book.discussionPointsEn : book.discussionPoints)?.map((item, idx) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-navy text-white flex items-center justify-center text-sm font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-gray-700">{item}</span>
                    </li>
                  )) || ([1, 2, 3] as const).map((num) => (
                    <li key={num} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-navy text-white flex items-center justify-center text-sm font-bold">
                        {num}
                      </span>
                      <span className="text-gray-700">{t(`question${num}`)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* External Links */}
              {book.links && (
                <section className="bg-gray-50 rounded-xl p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">🔗 {t('relatedLinks')}</h2>
                  <div className="flex flex-wrap gap-3">
                    {book.links.publisher && (
                      <a
                        href={book.links.publisher}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-brand-navy/10 rounded-full text-gray-700 transition-colors border border-brand-navy/20"
                      >
                        📚 {t('buyBook')}
                      </a>
                    )}
                    {book.links.notes && (
                      <a
                        href={book.links.notes}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-brand-navy/10 rounded-full text-gray-700 transition-colors border border-brand-navy/20"
                      >
                        📝 {t('fullNotes')}
                      </a>
                    )}
                  </div>
                </section>
              )}

              {/* Back to Books */}
              <div className="mt-12 pt-8 border-t border-gray-200">
                <Link
                  href={`/${locale}/books`}
                  className="inline-flex items-center gap-2 text-brand-navy hover:text-brand-pink transition-colors"
                  prefetch={false}
                >
                  ← {t('backToBooks')}
                </Link>
              </div>
            </main>

            {/* Sidebar */}
            <aside className="lg:col-span-1">
              <div className="sticky top-24">
                <Suspense fallback={
                  <div className="space-y-6">
                    <div className="animate-pulse bg-gray-200 rounded-2xl h-40" />
                    <div className="animate-pulse bg-gray-200 rounded-2xl h-48" />
                  </div>
                }>
                  <BookArticleSidebar articles={otherArticles} />
                </Suspense>
              </div>
            </aside>
        </div>
        </div>
      </div>
    </article>
  );
}
