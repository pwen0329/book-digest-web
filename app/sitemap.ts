import { MetadataRoute } from 'next';
import { getBooksSync } from '@/lib/books';
import { locales } from '@/lib/i18n';

// Use sync version to avoid Promise overhead (data is already static)
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bookdigest.club';
  const books = getBooksSync();

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
    '/about': new Date('2025-01-01'),
    '/joinus': new Date('2025-01-01'),
    '/privacy': new Date('2024-08-01'),
    '/terms': new Date('2024-08-01'),
  };

  const staticPaths = Object.keys(staticPageDates);
  const staticPages = staticPaths.flatMap((path) =>
    locales.map((locale) => {
      let changeFrequency: 'weekly' | 'monthly' = 'weekly';
      if (path === '/about' || path === '/privacy' || path === '/terms') {
        changeFrequency = 'monthly';
      }
      return {
        url: getLocalizedUrl(path, locale),
        lastModified: staticPageDates[path],
        changeFrequency,
        priority: path === '' ? 1 : path === '/books' || path === '/events' ? 0.9 : 0.7,
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
