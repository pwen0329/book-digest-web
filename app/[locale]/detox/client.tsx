'use client';

import ActivitySignupFlow from '@/components/ActivitySignupFlow';
import type { LocalizedEventContentMap } from '@/types/event-content';

export default function DetoxClient({ events }: { events: LocalizedEventContentMap }) {
  const event = events.DETOX;

  return (
    <ActivitySignupFlow
      activeTab="DETOX"
      location="DETOX"
      tabLabels={{ TW: events.TW.title, EN: events.EN.title, NL: events.NL.title, DETOX: events.DETOX.title }}
      translationNamespace="detoxSignupFlow"
      endpoint={process.env.NEXT_PUBLIC_FORMS_ENDPOINT_DETOX || '/api/submit?loc=DETOX'}
      posterSrc={event.posterSrc}
      posterAlt={event.posterAlt}
      posterPriority
      renderIntro={() => (
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold font-outfit">
            {event.title}
          </h1>
        </div>
      )}
    />
  );
}