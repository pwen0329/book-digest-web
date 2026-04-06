'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { BLUR_POSTER } from '@/lib/constants';
import type { VenueLocation } from '@/types/venue';
import type { Event } from '@/types/event';
import type { EventType } from '@/types/event-type';
import { EventRegistrationStatus } from '@/types/event';

type VenueEventsClientProps = {
  locale: string;
  venueLocation: VenueLocation;
  events: Event[];
  eventTypes: EventType[];
};

export default function VenueEventsClient({
  locale,
  venueLocation,
  events,
  eventTypes,
}: VenueEventsClientProps) {
  const t = useTranslations('events');

  // Find first event type that has events, or use first type
  const initialEventType = eventTypes.find(type =>
    events.some(e => e.eventTypeCode === type.code)
  )?.code || eventTypes[0]?.code || '';

  const [selectedEventType, setSelectedEventType] = useState<string>(initialEventType);

  // Track image errors per event
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // Handle image load errors
  const handleImageError = useCallback((eventId: number) => {
    setImageErrors(prev => new Set(prev).add(eventId));
  }, []);

  // Filter events by selected type
  const filteredEvents = events.filter(e => e.eventTypeCode === selectedEventType);

  // Get CTA class based on locale
  const ctaClass = locale === 'en'
    ? "inline-flex min-h-11 items-center justify-center rounded-full bg-brand-pink px-5 sm:px-7 py-2.5 sm:py-3 font-semibold text-white shadow font-outfit transition-all text-sm sm:text-base uppercase tracking-wider hover:brightness-110"
    : "inline-flex min-h-11 items-center justify-center rounded-full bg-brand-pink px-8 sm:px-9 py-2.5 sm:py-3 font-semibold text-white shadow transition-all text-base sm:text-lg tracking-[0.24em] sm:tracking-[0.3em] hover:brightness-110";

  return (
    <div className="space-y-8">
      {/* Event Type Tabs */}
      <div className="flex justify-center gap-2 flex-wrap">
        {eventTypes.map(type => (
          <button
            key={type.code}
            onClick={() => setSelectedEventType(type.code)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedEventType === type.code
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {locale === 'en' ? type.nameEn : type.nameZh}
          </button>
        ))}
      </div>

      {/* Selected Event Display */}
      {filteredEvents.length === 0 ? (
        <div className="text-center text-white/70 py-12">
          {t('noEventsFound')}
        </div>
      ) : (
        filteredEvents.map(event => (
          <div
            key={event.id}
            className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-center lg:justify-center"
          >
            {/* Event Image */}
            <div className="w-full lg:w-5/12 flex justify-center">
              <div
                className="relative w-full max-w-[360px] sm:max-w-[400px] lg:max-w-none rounded-xl overflow-hidden shadow-xl"
                style={{ aspectRatio: '4/5' }}
              >
                {imageErrors.has(event.id) ? (
                  // Fallback for failed images
                  <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                    <div className="text-center text-white/50 p-4">
                      <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">{t('imageNotAvailable')}</p>
                    </div>
                  </div>
                ) : (
                  <Image
                    src={
                      (locale === 'en' ? event.coverUrlEn : event.coverUrl) ||
                      event.coverUrl ||
                      '/images/events/default.jpg'
                    }
                    alt={
                      (locale === 'en' ? event.titleEn : event.title) || event.title
                    }
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    placeholder="blur"
                    blurDataURL={BLUR_POSTER}
                    onError={() => handleImageError(event.id)}
                    unoptimized
                  />
                )}
              </div>
            </div>

            {/* Event Content */}
            <div className="w-full lg:flex-1 flex flex-col justify-center">
              <h3 className="text-2xl md:text-3xl font-bold text-white font-outfit">
                {(locale === 'en' ? event.titleEn : event.title) || event.title}
              </h3>
              <p className="mt-6 text-white/80 leading-relaxed whitespace-pre-line text-lg font-outfit">
                {(locale === 'en' ? event.descriptionEn : event.description) ||
                  event.description ||
                  ''}
              </p>

              {/* Event Date */}
              <div className="mt-4 text-sm text-white/70">
                {new Date(event.eventDate).toLocaleDateString(
                  locale === 'en' ? 'en-US' : 'zh-TW',
                  {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  }
                )}
              </div>

              {/* CTA Button */}
              <div className="mt-8">
                {event.registrationStatus === EventRegistrationStatus.OPEN ? (
                  <Link
                    href={`/${locale}/signup/${event.slug}`}
                    className={ctaClass}
                    prefetch={false}
                  >
                    {t('signUp')}
                  </Link>
                ) : event.registrationStatus === EventRegistrationStatus.NOT_YET_OPEN ? (
                  <button
                    disabled
                    className={`${ctaClass} opacity-50 cursor-not-allowed`}
                  >
                    {t('comingSoon')}
                  </button>
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
        ))
      )}
    </div>
  );
}
