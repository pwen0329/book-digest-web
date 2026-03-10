'use client';

import { useTranslations } from 'next-intl';
import ActivitySignupFlow from '@/components/ActivitySignupFlow';

export default function DetoxClient() {
  const t = useTranslations('events');

  return (
    <ActivitySignupFlow
      activeTab="DETOX"
      location="DETOX"
      translationNamespace="detoxSignupFlow"
      endpoint={process.env.NEXT_PUBLIC_FORMS_ENDPOINT_DETOX || '/api/submit?loc=DETOX'}
      posterSrc="/images/elements/poster_202604_detox.jpg"
      posterAlt={t('detoxTitle')}
      posterPriority
      renderIntro={() => (
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold font-outfit">
            {t('detoxTitle')}
          </h1>
        </div>
      )}
    />
  );
}