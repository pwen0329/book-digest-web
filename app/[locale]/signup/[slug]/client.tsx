'use client';

import SignupClient from '@/app/[locale]/signup/client';
import type { Event } from '@/types/event';
import { EventRegistrationStatus } from '@/types/event';

type EventDetailClientProps = {
  event: Event;
  locale: string;
};

export default function EventDetailClient({ event, locale }: EventDetailClientProps) {
  const language = locale === 'en' ? 'en' : 'zh';

  const title = (language === 'en' ? event.titleEn : event.title) || event.title;
  const description = (language === 'en' ? event.descriptionEn : event.description) || event.description || '';
  const coverUrl = (language === 'en' ? event.coverUrlEn : event.coverUrl) || event.coverUrl;

  // Use registration status from event (should be populated by server)
  const registrationStatus = event.registrationStatus || EventRegistrationStatus.UNKNOWN;

  // Convert Event to EventData format for SignupClient
  const eventData = {
    id: event.id,
    slug: event.slug,
    posterSrc: coverUrl || '/images/events/default.jpg',
    posterAlt: title,
    title,
    description,
    eventDate: event.eventDate,
    registrationOpensAt: event.registrationOpensAt,
    registrationClosesAt: event.registrationClosesAt,
    attendanceMode: event.venue?.isVirtual ? 'online' as const : 'offline' as const,
    locationName: event.venue?.name || '',
    venueLocation: event.venue?.location || 'TW',
    addressCountry: event.venue?.location === 'TW' ? 'TW' : event.venue?.location === 'NL' ? 'NL' : undefined,
    registrationStatus,
  };

  return (
    <SignupClient
      event={eventData}
      locale={locale}
      showIntro={false}
    />
  );
}
