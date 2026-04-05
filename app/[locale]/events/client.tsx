'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BLUR_POSTER } from '@/lib/constants';
import type { VenueLocation } from '@/types/venue';
import { EventRegistrationStatus } from '@/types/event';
import type { EventRegistrationStatus as EventRegistrationStatusType } from '@/types/event';

type EventData = {
  id: number;
  slug: string;
  posterSrc: string;
  posterAlt: string;
  title: string;
  description: string;
  eventDate: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  attendanceMode: 'offline' | 'online';
  locationName: string;
  venueLocation: VenueLocation;
  addressCountry?: string;
  registrationStatus: EventRegistrationStatusType;
};

type EventsClientProps = {
  locale: string;
  eventsMap: Record<VenueLocation, EventData[]>;
  signUpText: string;
  ctaClass: string;
};

export default function EventsClient({ locale, eventsMap, signUpText, ctaClass }: EventsClientProps) {
  const t = useTranslations('events');
  const searchParams = useSearchParams();

  // Get query params for pre-selection
  const venueParam = searchParams.get('venue') as VenueLocation | null;
  const eventIdParam = searchParams.get('event');

  // Determine initial venue (from query param or default to TW)
  const initialVenue = venueParam && eventsMap[venueParam] ? venueParam : 'TW';

  const [selectedVenue, setSelectedVenue] = useState<VenueLocation>(initialVenue);
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);

  // Effect to pre-select event based on query param
  useEffect(() => {
    if (eventIdParam && eventsMap[selectedVenue]) {
      const eventIndex = eventsMap[selectedVenue].findIndex(
        e => e.id === parseInt(eventIdParam, 10)
      );
      if (eventIndex !== -1) {
        setSelectedEventIndex(eventIndex);
      }
    }
  }, [eventIdParam, selectedVenue, eventsMap]);

  const venueEvents = eventsMap[selectedVenue];
  const selectedEvent = venueEvents[selectedEventIndex];

  const venueLabels: Record<VenueLocation, string> = {
    TW: t('venueTW'),
    NL: t('venueNL'),
    ONLINE: t('venueONLINE'),
  };

  return (
    <div className="space-y-8">
      {/* Venue Tabs */}
      <div className="flex justify-center gap-4">
        {(Object.keys(eventsMap) as VenueLocation[]).map((venue) => (
          <button
            key={venue}
            onClick={() => {
              setSelectedVenue(venue);
              setSelectedEventIndex(0);
            }}
            className={`px-6 py-3 rounded-full font-semibold transition-all ${
              selectedVenue === venue
                ? 'bg-brand-pink text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {venueLabels[venue]} ({eventsMap[venue].length})
          </button>
        ))}
      </div>

      {/* Event Tabs (show titles) */}
      {venueEvents.length > 1 && (
        <div className="flex justify-center gap-2 flex-wrap">
          {venueEvents.map((event, index) => (
            <button
              key={event.id}
              onClick={() => setSelectedEventIndex(index)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedEventIndex === index
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {event.title}
            </button>
          ))}
        </div>
      )}

      {/* Selected Event Display */}
      {selectedEvent && (
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-center lg:justify-center">
          {/* Event Image */}
          <div className="w-full lg:w-5/12 flex justify-center">
            <div
              className="relative w-full max-w-[360px] sm:max-w-[400px] lg:max-w-none rounded-xl overflow-hidden shadow-xl"
              style={{ aspectRatio: '4/5' }}
            >
              <Image
                src={selectedEvent.posterSrc}
                alt={selectedEvent.posterAlt}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                placeholder="blur"
                blurDataURL={BLUR_POSTER}
              />
            </div>
          </div>

          {/* Event Content */}
          <div className="w-full lg:flex-1 flex flex-col justify-center">
            <h3 className="text-2xl md:text-3xl font-bold text-white font-outfit">
              {selectedEvent.title}
            </h3>
            <p className="mt-6 text-white/80 leading-relaxed whitespace-pre-line text-lg font-outfit">
              {selectedEvent.description}
            </p>

            {/* Event Date and Registration Status */}
            <div className="mt-4 space-y-1">
              <div className="text-sm text-white/70">
                {new Date(selectedEvent.eventDate).toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-TW', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
              </div>
            </div>

            <div className="mt-8">
              {selectedEvent.registrationStatus === EventRegistrationStatus.OPEN ? (
                <Link
                  href={`/${locale}/signup/${selectedEvent.slug}`}
                  className={ctaClass}
                  prefetch={false}
                >
                  {signUpText}
                </Link>
              ) : (
                <button
                  disabled
                  className={`${ctaClass} opacity-50 cursor-not-allowed`}
                >
                  {t('registrationClosed')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
