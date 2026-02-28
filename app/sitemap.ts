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

  // Static pages with all locales
  const staticPaths = ['', '/books', '/events', '/about', '/joinus', '/privacy', '/terms'];
  const staticPages = staticPaths.flatMap((path) =>
    locales.map((locale) => {
      let changeFrequency: 'weekly' | 'monthly' = 'weekly';
      if (path === '/about' || path === '/privacy' || path === '/terms') {
        changeFrequency = 'monthly';
      }
      return {
        url: getLocalizedUrl(path, locale),
        lastModified: new Date(),
        changeFrequency,
        priority: path === '' ? 1 : path === '/books' || path === '/events' ? 0.9 : 0.7,
      };
    })
  );

  // Dynamic book pages with all locales
  const bookPages = books.flatMap((book) =>
    locales.map((locale) => ({
      url: getLocalizedUrl(`/books/${book.slug}`, locale),
      lastModified: book.readDate ? new Date(book.readDate) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }))
  );

  return [...staticPages, ...bookPages];
}
