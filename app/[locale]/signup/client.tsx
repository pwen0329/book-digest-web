'use client';
import { useTranslations } from 'next-intl';
import ActivitySignupFlow, { type ActivitySignupSlotStatus } from '@/components/ActivitySignupFlow';
import type { LocalizedEventContentMap } from '@/types/event-content';

function SignupContent({ initialLocation, events, initialSlotStatus }: { initialLocation?: string; events: LocalizedEventContentMap; initialSlotStatus: ActivitySignupSlotStatus }) {
  const t = useTranslations('events');
  const activeLocation: 'TW' | 'NL' = initialLocation === 'NL' ? 'NL' : 'TW';
  const activeEvent = events[activeLocation];
  const locationLocked = initialLocation === 'TW' || initialLocation === 'NL';

  return (
    <ActivitySignupFlow
      activeTab={activeLocation}
      location={activeLocation}
      tabLabels={{ TW: events.TW.title, EN: events.EN.title, NL: events.NL.title, DETOX: events.DETOX.title }}
      translationNamespace="signupFlow"
      initialSlotStatus={initialSlotStatus}
      endpoint={
        activeLocation === 'TW'
          ? process.env.NEXT_PUBLIC_FORMS_ENDPOINT_TW || '/api/submit?loc=TW'
          : process.env.NEXT_PUBLIC_FORMS_ENDPOINT_NL || '/api/submit?loc=NL'
      }
      posterSrc={activeEvent.posterSrc}
      posterBlurDataURL={activeEvent.posterBlurDataURL}
      posterAlt={activeEvent.posterAlt}
      comingSoon={activeEvent.comingSoon ? { title: activeEvent.title, body: activeEvent.comingSoonBody } : undefined}
      renderIntro={(step) => !locationLocked && step === 0 ? (
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold font-outfit">
            {t('joinBookClub')}
          </h1>
          <p className="mt-2 text-white/70">
            {t('chooseLocation')}
          </p>
        </div>
      ) : null}
    />
  );
}

export default function SignupClient({ initialLocation, events, initialSlotStatus }: { initialLocation?: string; events: LocalizedEventContentMap; initialSlotStatus: ActivitySignupSlotStatus }) {
  return <SignupContent initialLocation={initialLocation} events={events} initialSlotStatus={initialSlotStatus} />;
}
