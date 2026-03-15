'use client';
import ActivitySignupFlow from '@/components/ActivitySignupFlow';
import type { LocalizedEventContentMap } from '@/types/event-content';

function EngClubContent({ events }: { events: LocalizedEventContentMap }) {
  const event = events.EN;
  return (
    <ActivitySignupFlow
      activeTab="EN"
      location="EN"
      tabLabels={{ TW: events.TW.title, EN: events.EN.title, NL: events.NL.title, DETOX: events.DETOX.title }}
      translationNamespace="signupFlow"
      endpoint={process.env.NEXT_PUBLIC_FORMS_ENDPOINT_EN || '/api/submit?loc=EN'}
      posterSrc={event.posterSrc}
      posterBlurDataURL={event.posterBlurDataURL}
      posterAlt={event.posterAlt}
      posterPriority
    />
  );
}

export default function EngClubClient({ events }: { events: LocalizedEventContentMap }) {
  return <EngClubContent events={events} />;
}
