import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { locales, setRequestLocale } from '@/lib/i18n';
import { getLocaleAlternates } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'zh' ? '隱私權政策' : 'Privacy Policy',
    description:
      locale === 'zh'
        ? 'Book Digest 隱私權政策，說明我們如何蒐集、使用與保護您的個人資料。'
        : 'Book Digest privacy policy describing how we collect, use, and protect your personal data.',
    alternates: getLocaleAlternates('privacy', locale),
    robots: { index: true, follow: true },
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('privacy');
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
