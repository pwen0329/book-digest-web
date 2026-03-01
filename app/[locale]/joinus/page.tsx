import { locales, setRequestLocale } from '@/lib/i18n';
import { getLocaleAlternates } from '@/lib/seo';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import JoinUsClient from './client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Join Us',
    description: 'Become a Book Digest host. Lead conversations, connect readers, and build community.',
    alternates: getLocaleAlternates('joinus', locale),
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function JoinUsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('joinus');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bookdigest.club';
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: t('hostTitle'), acceptedAnswer: { '@type': 'Answer', text: t('hostIntro') } },
      { '@type': 'Question', name: t('whyJoinTitle'), acceptedAnswer: { '@type': 'Answer', text: t('whyJoinDesc') } },
      { '@type': 'Question', name: t('whereTitle'), acceptedAnswer: { '@type': 'Answer', text: t('whereDesc') } },
      { '@type': 'Question', name: t('uncertainTitle'), acceptedAnswer: { '@type': 'Answer', text: t('uncertainDesc') } },
      { '@type': 'Question', name: t('applyTitle'), acceptedAnswer: { '@type': 'Answer', text: t('applyDesc') } },
    ],
    url: `${siteUrl}/${locale}/joinus`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/<\/script>/gi, '<\\/script>') }}
      />
      <JoinUsClient />
    </>
  );
}
