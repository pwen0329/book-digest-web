import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { locales, setRequestLocale } from '@/lib/i18n';
import { getLocaleAlternates } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'zh' ? '條款與細則' : 'Terms and Conditions',
    description:
      locale === 'zh'
        ? 'Book Digest 服務條款與細則，包含使用規範與相關法律資訊。'
        : 'Book Digest terms and conditions for website use and related legal information.',
    alternates: getLocaleAlternates('terms', locale),
    robots: { index: true, follow: true },
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('terms');
  return (
    <section className="bg-brand-navy text-white min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl md:text-4xl font-bold tracking-wide">{t('title')}</h1>
        
        <div className="mt-8 space-y-6 text-white/80 leading-relaxed">
          <p>
            {t('intro')}
          </p>
          
          <p>
            {t('contact')} <a href="mailto:bookdigest2020@gmail.com" className="text-brand-pink hover:underline">bookdigest2020@gmail.com</a>
          </p>
        </div>
      </div>
    </section>
  );
}
