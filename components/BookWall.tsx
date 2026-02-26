import Link from 'next/link';
import Image from 'next/image';
import { getTranslations, getLocale } from 'next-intl/server';
import { getRecentBooksSync, getLocalizedTitle } from '@/lib/books';
import { BLUR_BOOK_COVER } from '@/lib/constants';

export default async function BookWall() {
  const t = await getTranslations('home');
  const locale = await getLocale();
  
  // Show latest books only: desktop 6 columns × 4 rows = 24 books
  const allBooks = getRecentBooksSync(24);

  return (
    <section aria-labelledby="books-wall-heading" className="bg-brand-navy">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 id="books-wall-heading" className="text-2xl md:text-3xl font-bold tracking-wide text-white">{t('recentReads')}</h2>
          <Link href="/books" className="text-sm font-semibold text-brand-pink hover:underline">{t('viewAll')}</Link>
        </div>

        <ul className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 md:gap-6">
          {/* Mobile: 2 cols × 5 rows = 10 books; larger screens: show all */}
          {allBooks.map((book, index) => (
            <li key={book.id} className={`group ${index >= 10 ? 'hidden sm:list-item' : ''}`}>
              <Link href={`/books/${book.slug}`} className="block" prefetch={false}>
                <div className="relative aspect-[7/10] overflow-hidden rounded-md bg-white shadow ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-[1.03]">
                  <Image
                    src={book.coverUrl || '/images/placeholder-cover.svg'}
                    alt={book.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    className="object-cover"
                    loading={index < 6 ? 'eager' : 'lazy'}
                    placeholder="blur"
                    blurDataURL={BLUR_BOOK_COVER}
                  />
                  {/* Hover overlay with book info */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2 md:p-3">
                    <h3 className="text-white text-xs md:text-sm font-semibold leading-tight line-clamp-2">
                      {getLocalizedTitle(book, locale)}
                    </h3>
                    <p className="text-white/70 text-[10px] md:text-xs mt-1 truncate">
                      {book.author}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-6 text-center md:hidden">
          <Link href="/books" className={`inline-flex items-center rounded-full bg-brand-pink px-5 py-2.5 font-semibold text-white hover:brightness-110 transition-all ${locale === 'zh' ? 'tracking-widest' : ''}`}>{t('browseBooks')}</Link>
        </div>
      </div>
    </section>
  );
}
