import { notFound } from 'next/navigation';
import { locales, setRequestLocale } from '@/lib/i18n';
import { getEventBySlug } from '@/lib/events';
import type { Metadata } from 'next';
import EventDetailClient from './client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const event = await getEventBySlug(slug, { includeVenue: true, includeBook: true });

  if (!event || !event.isPublished) {
    return {
      title: 'Event Not Found',
    };
  }

  const language = locale === 'en' ? 'en' : 'zh';
  const title = (language === 'en' ? event.titleEn : event.title) || event.title;
  const description = (language === 'en' ? event.descriptionEn : event.description) || event.description || '';

  return {
    title,
    description: description.slice(0, 160) || undefined,
    openGraph: {
      title,
      description: description.slice(0, 160) || undefined,
      locale: locale === 'zh' ? 'zh_TW' : 'en_US',
      images: event.coverUrl ? [(language === 'en' ? event.coverUrlEn : event.coverUrl) || event.coverUrl] : undefined,
    },
    robots: {
      index: event.isPublished,
      follow: event.isPublished,
    },
  };
}

export function generateStaticParams() {
  // Generate params for all locale combinations
  // Actual slugs will be resolved dynamically
  return locales.map((locale) => ({ locale, slug: 'placeholder' }));
}

export default async function EventPage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const event = await getEventBySlug(slug, { includeVenue: true, includeBook: true });

  // Return 404 if event doesn't exist or is not published
  if (!event || !event.isPublished) {
    notFound();
  }

  return (
    <EventDetailClient
      event={event}
      locale={locale}
    />
  );
}
