'use client';
import { useTranslations, useLocale } from 'next-intl';
import ActivitySignupFlow from '@/components/ActivitySignupFlow';

function SignupContent({ initialLocation }: { initialLocation?: string }) {
  const t = useTranslations('events');
  const locale = useLocale();
  const activeLocation: 'TW' | 'NL' = initialLocation === 'NL' ? 'NL' : 'TW';

  const locationLocked = initialLocation === 'TW' || initialLocation === 'NL';
  const isNlComingSoon = activeLocation === 'NL';

  return (
    <ActivitySignupFlow
      activeTab={activeLocation}
      location={activeLocation}
      translationNamespace="signupFlow"
      endpoint={
        activeLocation === 'TW'
          ? process.env.NEXT_PUBLIC_FORMS_ENDPOINT_TW || '/api/submit?loc=TW'
          : process.env.NEXT_PUBLIC_FORMS_ENDPOINT_NL || '/api/submit?loc=NL'
      }
      posterSrc={activeLocation === 'TW' ? '/images/elements/poster_202603_taiwan.webp' : '/images/elements/AD-15.webp'}
      posterAlt={activeLocation === 'TW' ? 'Taiwan Book Club' : 'Netherlands Book Club'}
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
      comingSoon={isNlComingSoon ? { title: t('nlTitle'), body: locale === 'zh' ? 'Coming soon…' : 'Coming soon…' } : undefined}
    />
  );
}

export default function SignupClient({ initialLocation }: { initialLocation?: string }) {
  return <SignupContent initialLocation={initialLocation} />;
}
