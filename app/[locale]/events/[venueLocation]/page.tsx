import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import dynamic from 'next/dynamic';
import { getEventsByVenueAndType } from '@/lib/events';
import { getEventTypes } from '@/lib/event-types';
import { getLocales } from '@/lib/i18n';
import type { VenueLocation } from '@/types/venue';
import { getVenueLocations } from '@/types/venue';
import VenueEventsClient from './client';

// Counter is a client component; lazy-load it
const Counter = dynamic(() => import('@/components/Counter'), { ssr: false });

export async function generateStaticParams() {
  const locales = getLocales();
  const venueLocations = getVenueLocations();

  return locales.flatMap(locale =>
    venueLocations.map(venueLocation => ({ locale, venueLocation }))
  );
}

type Props = {
  params: Promise<{ locale: string; venueLocation: string }>;
};

export default async function VenueEventsPage({ params }: Props) {
  const { locale, venueLocation } = await params;

  // Validate venue location
  const validLocations = getVenueLocations();
  if (!validLocations.includes(venueLocation as VenueLocation)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'events' });

  // Fetch events for this venue (hide expired by default)
  const rawEvents = await getEventsByVenueAndType(venueLocation as VenueLocation);
  const eventTypes = await getEventTypes();

  // Sanitize event image URLs to prevent build/SSR errors
  // Only allow paths starting with '/', otherwise use default
  const DEFAULT_IMAGE = '/images/events/default.jpg';
  const isValidImagePath = (url: string | null | undefined): boolean => {
    return !!url && typeof url === 'string' && url.startsWith('/');
  };

  const events = rawEvents.map(event => ({
    ...event,
    coverUrl: isValidImagePath(event.coverUrl) ? event.coverUrl : DEFAULT_IMAGE,
    coverUrlEn: isValidImagePath(event.coverUrlEn) ? event.coverUrlEn : null,
  }));

  // Calculate statistics using same formula as old events page
  const startDate = new Date('2020-07-31');
  const now = new Date();
  const readingDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const baseDate = new Date('2026-03-01');
  const monthsDiff = (now.getFullYear() - baseDate.getFullYear()) * 12 + (now.getMonth() - baseDate.getMonth());
  const safeMonthsDiff = Math.max(0, monthsDiff);

  const clubsHeld = 78 + safeMonthsDiff * 2;
  const readersJoined = 300 + safeMonthsDiff * 15;

  return (
    <section className="bg-brand-navy text-white min-h-screen">
      <div className="mx-auto max-w-5xl px-6 lg:px-16 py-16">
        {/* Stats Counters */}
        <div className="grid grid-cols-3 gap-2 min-[420px]:gap-6 mb-16" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <div className="min-[420px]:translate-x-4 min-w-0">
            <Counter target={readingDays} label={t('readingDays')} />
          </div>
          <div className="min-w-0">
            <Counter target={clubsHeld} label={t('clubsHeld')} />
          </div>
          <div className="min-[420px]:-translate-x-4 min-w-0">
            <Counter target={readersJoined} label={t('readersJoined')} />
          </div>
        </div>

        {/* Events with Event Type Tabs */}
        <VenueEventsClient
          locale={locale}
          venueLocation={venueLocation as VenueLocation}
          events={events}
          eventTypes={eventTypes}
        />
      </div>
    </section>
  );
}
