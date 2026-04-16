'use client';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import ActivitySignupFlow, { SignupStep } from '@/components/ActivitySignupFlow';
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

type SignupClientProps = {
  event: EventData;
  locale: string;
  showIntro?: boolean;
};

export default function SignupClient({ event, showIntro = false }: SignupClientProps) {
  const t = useTranslations('events');

  // Build event-based registration endpoint
  const endpoint = `/api/event/${event.slug}/register`;

  // Memoize registration status to prevent recalculation on every render
  const comingSoonMessage = useMemo(() => {
    let comingSoon: { title: string; body?: string } | undefined;

    if (event.registrationStatus !== EventRegistrationStatus.OPEN) {
      if (event.registrationStatus === EventRegistrationStatus.CLOSED) {
        // Event has ended
        comingSoon = {
          title: t('registrationClosed'),
          body: t('eventEnded'),
        };
      } else if (event.registrationStatus === EventRegistrationStatus.UPCOMING) {
        // Registration not yet open
        comingSoon = {
          title: event.title,
          body: undefined,
        };
      }
    }

    return comingSoon;
  }, [event.registrationStatus, event.title, t]);

  return (
    <ActivitySignupFlow
      eventSlug={event.slug}
      endpoint={endpoint}
      venueLocation={event.venueLocation}
      posterSrc={event.posterSrc}
      posterBlurDataURL={undefined}
      posterAlt={event.posterAlt}
      comingSoon={comingSoonMessage}
      renderIntro={(step) => showIntro && step === SignupStep.INTRO ? (
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold font-outfit">
            {t('joinBookClub')}
          </h1>
          <p className="mt-2 text-white/70">
            {event.title}
          </p>
        </div>
      ) : null}
    />
  );
}
