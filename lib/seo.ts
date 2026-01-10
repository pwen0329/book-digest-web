import type { Metadata, Viewport } from 'next';

// Base URL for the site
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bookdigest.club';

// Viewport configuration (Next.js 14 recommends separate export)
export const defaultViewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F2E66',
};

// Default SEO configuration
export const defaultSEO: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Book Digest - A space to rest, read, and reconnect',
    template: '%s | Book Digest',
  },
  description:
    'Come join the conversation! Put your phone down, pick a book up. Join our book club and digital detox community.',
  keywords: [
    'book club',
    'reading',
    'digital detox',
    'mindfulness',
    'book discussion',
    'reading community',
    '讀書會',
    '閱讀',
    '數位排毒',
  ],
  authors: [{ name: 'Book Digest' }],
  creator: 'Book Digest',
  publisher: 'Book Digest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'zh_TW',
    url: siteUrl,
    siteName: 'Book Digest',
    title: 'Book Digest - A space to rest, read, and reconnect',
    description:
      'Come join the conversation! Put your phone down, pick a book up. Join our book club and digital detox community.',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Book Digest - A space to rest, read, and reconnect',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Book Digest - A space to rest, read, and reconnect',
    description:
      'Come join the conversation! Put your phone down, pick a book up. Join our book club and digital detox community.',
    images: ['/images/og-image.png'],
  },
  icons: '/eyes2.ico',
  manifest: '/site.webmanifest',
  alternates: {
    canonical: siteUrl,
    languages: {
      'en': siteUrl,
      'zh-TW': `${siteUrl}?lang=zh`,
    },
  },
};

// Page-specific SEO configurations
export const pageSEO = {
  home: {
    title: 'Book Digest - A space to rest, read, and reconnect',
    description:
      'Come join the conversation! Put your phone down, pick a book up. Join our book club and digital detox community.',
  },
  books: {
    title: 'Books',
    description:
      'Explore our curated collection of books. From fiction to psychology, discover reads that spark meaningful conversations.',
  },
  events: {
    title: 'Events',
    description:
      'Join our book club events in Taiwan and Netherlands. Sign up for monthly reading sessions and digital detox challenges.',
  },
  about: {
    title: 'About Us',
    description:
      'Learn about Book Digest - a community to rest, read, and reconnect. Discover our story and why readers love joining us.',
  },
};

// Generate book-specific SEO
export function generateBookSEO(book: {
  title: string;
  author: string;
  summary?: string;
  coverUrl?: string;
}): Metadata {
  const title = `${book.title} by ${book.author}`;
  const description = book.summary || `Book review and discussion of ${book.title} by ${book.author}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: book.coverUrl ? [{ url: book.coverUrl, alt: book.title }] : undefined,
    },
    twitter: {
      title,
      description,
      images: book.coverUrl ? [book.coverUrl] : undefined,
    },
  };
}
