import { MetadataRoute } from 'next';
import { getBooks } from '@/lib/books';
import { locales } from '@/lib/i18n';
import { CLIENT_ENV } from '@/lib/env';

// Use sync version to avoid Promise overhead (data is already static)
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = CLIENT_ENV.SITE_URL;
  const books = await getBooks();

  // Generate URLs for each locale (always include locale prefix)
  const getLocalizedUrl = (path: string, locale: string) => {
    return `${baseUrl}/${locale}${path}`;
  };

  // Derive site last modified from the most recent book readDate
  const latestBookDate = books.reduce((latest, book) => {
    if (book.readDate) {
      const d = new Date(book.readDate);
      return d > latest ? d : latest;
    }
    return latest;
  }, new Date('2020-07-31'));

  // Static pages with meaningful lastmod dates
  const staticPageDates: Record<string, Date> = {
    '': latestBookDate, // Home page changes when new books are added
    '/books': latestBookDate, // Books page changes with new books
    '/events': new Date('2025-06-01'), // Update when events change
    '/detox': new Date('2025-06-01'),
    '/engclub': new Date('2025-06-01'),
    '/about': new Date('2025-01-01'),
    '/joinus': new Date('2025-01-01'),
    '/privacy': new Date('2024-08-01'),
    '/terms': new Date('2024-08-01'),
  };

  const staticPaths = Object.keys(staticPageDates);
  const staticPages = staticPaths.flatMap((path) =>
    locales.map((locale) => {
      let changeFrequency: 'weekly' | 'monthly' = 'weekly';
      if (path === '/about' || path === '/joinus' || path === '/privacy' || path === '/terms') {
        changeFrequency = 'monthly';
      }
      return {
        url: getLocalizedUrl(path, locale),
        lastModified: staticPageDates[path],
        changeFrequency,
        priority: path === ''
          ? 1
          : path === '/books' || path === '/events' || path === '/detox' || path === '/engclub'
            ? 0.9
            : 0.7,
      };
    })
  );

  // Dynamic book pages with all locales
  const bookPages = books.flatMap((book) =>
    locales.map((locale) => ({
      url: getLocalizedUrl(`/books/${book.slug}`, locale),
      lastModified: book.readDate ? new Date(book.readDate) : new Date('2024-01-01'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }))
  );

  return [...staticPages, ...bookPages];
}
