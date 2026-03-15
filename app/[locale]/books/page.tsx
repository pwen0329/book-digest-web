import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { getBooks, getLocalizedBook } from '@/lib/books';
import { BLUR_BOOK_COVER } from '@/lib/constants';
import { locales, setRequestLocale } from '@/lib/i18n';
import { pageSEO, getLocaleAlternates } from '@/lib/seo';
import type { Metadata } from 'next';

// ISR: regenerate books listing hourly
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: pageSEO.books.title,
    description: pageSEO.books.description,
    openGraph: { title: pageSEO.books.title, description: pageSEO.books.description, locale: locale === 'zh' ? 'zh_TW' : 'en_US' },
    alternates: getLocaleAlternates('books', locale),
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function BooksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('books');

  const data = (await getBooks()).map((book) => getLocalizedBook(book, locale));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bookdigest.club';
  const booksListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: locale === 'zh' ? 'Book Digest 書單' : 'Book Digest Reading List',
    numberOfItems: data.length,
    itemListElement: data.slice(0, 30).map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Book',
        name: b.displayTitle,
        author: { '@type': 'Person', name: b.displayAuthor },
        url: `${siteUrl}/${locale}/books/${b.slug}`,
      },
    })),
  };

  return (
    <section className="bg-brand-navy text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(booksListJsonLd).replace(/<\/script>/gi, '<\\/script>') }}
      />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="sr-only">{t('title')}</h1>

        <ul className="mt-8 grid gap-x-6 gap-y-10 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {data.map((b, index) => (
            <li key={b.id} className="group">
              <Link href={`/${locale}/books/${b.slug}`} className="block" prefetch={false} aria-label={`${b.displayTitle} — ${b.displayAuthor}`}>
                <div className="relative aspect-[7/10] bg-white rounded-lg shadow-xl overflow-hidden">
                  <Image
                    src={b.displayCoverUrl || b.coverUrl || '/images/placeholder-cover.svg'}
                    alt={b.displayTitle}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="object-cover"
                    loading={index < 5 ? 'eager' : 'lazy'}
                    fetchPriority={index < 5 ? 'high' : undefined}
                    placeholder="blur"
                    blurDataURL={b.displayCoverBlurDataURL || BLUR_BOOK_COVER}
                  />
                  {/* Hover overlay with book summary */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 md:p-4">
                    <h3 className="text-white text-sm md:text-base font-semibold leading-tight line-clamp-2">
                      {b.displayTitle}
                    </h3>
                    <p className="text-white/70 text-xs md:text-sm mt-1">
                      {b.displayAuthor}
                    </p>
                    {b.displaySummary && (
                      <p className="text-white/80 text-xs mt-2 line-clamp-3 leading-relaxed">
                        {b.displaySummary}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-sm group-hover:opacity-50 transition-opacity">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold line-clamp-2 tracking-wide flex-1 text-base md:text-lg">{b.displayTitle}</span>
                  </div>
                  <div className="text-white/70 mt-1 text-sm">{b.displayAuthor}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
