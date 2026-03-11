'use client';
import { useTranslations } from 'next-intl';
import ActivitySignupFlow from '@/components/ActivitySignupFlow';

function EngClubContent() {
  const t = useTranslations('events');
  return (
    <ActivitySignupFlow
      activeTab="EN"
      location="EN"
      translationNamespace="signupFlow"
      endpoint={process.env.NEXT_PUBLIC_FORMS_ENDPOINT_EN || '/api/submit?loc=EN'}
      posterSrc="/images/elements/poster_202604_en_online.webp"
      posterAlt={t('onlineTitle')}
      posterPriority
    />
  );
}

export default function EngClubClient() {
  return <EngClubContent />;
}
