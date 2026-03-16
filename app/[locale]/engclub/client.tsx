'use client';
import ActivitySignupFlow, { type ActivitySignupSlotStatus } from '@/components/ActivitySignupFlow';
import type { LocalizedEventContentMap } from '@/types/event-content';

function EngClubContent({ events, initialSlotStatus }: { events: LocalizedEventContentMap; initialSlotStatus: ActivitySignupSlotStatus }) {
  const event = events.EN;
  return (
    <ActivitySignupFlow
      activeTab="EN"
      location="EN"
      tabLabels={{ TW: events.TW.title, EN: events.EN.title, NL: events.NL.title, DETOX: events.DETOX.title }}
      translationNamespace="signupFlow"
      initialSlotStatus={initialSlotStatus}
      endpoint={process.env.NEXT_PUBLIC_FORMS_ENDPOINT_EN || '/api/submit?loc=EN'}
      posterSrc={event.posterSrc}
      posterBlurDataURL={event.posterBlurDataURL}
      posterAlt={event.posterAlt}
      posterPriority
    />
  );
}

export default function EngClubClient({ events, initialSlotStatus }: { events: LocalizedEventContentMap; initialSlotStatus: ActivitySignupSlotStatus }) {
  return <EngClubContent events={events} initialSlotStatus={initialSlotStatus} />;
}
