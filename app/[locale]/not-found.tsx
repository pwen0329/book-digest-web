import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  const locale = await getLocale();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-navy to-brand-blue">
      <div className="text-center text-white px-6">
        <h1 className="text-6xl md:text-8xl font-bold mb-4">404</h1>
        <h2 className="text-2xl md:text-3xl font-semibold mb-4">
          {t('title')}
        </h2>
        <p className="text-white/70 mb-8 max-w-md mx-auto">
          {t('description')}
        </p>
        <Link
          href="/"
          className={`inline-flex items-center gap-2 px-6 py-3 bg-brand-pink text-white font-semibold rounded-full hover:brightness-110 transition-all ${locale === 'zh' ? 'tracking-widest' : ''}`}
        >
          ← {t('backHome')}
        </Link>
      </div>
    </div>
  );
}
