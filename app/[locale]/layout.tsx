import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import Script from 'next/script';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LangToggle from '@/components/LangToggle';
import { defaultViewport, getLocaleMetadata } from '@/lib/seo';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Outfit } from 'next/font/google';
import { locales, type Locale, setRequestLocale } from '@/lib/i18n';

// Lazy-load non-critical floating UI (not needed for first paint)
const FloatingInstagram = dynamic(() => import('@/components/FloatingInstagram'), { ssr: false });

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return getLocaleMetadata(locale);
}
export const viewport: Viewport = defaultViewport;

// Generate static params for all supported locales
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  
  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Enable static rendering for this locale
  setRequestLocale(locale);

  const messages = await getMessages();
  const t = await getTranslations('common');

  // Read nonce from middleware for CSP
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') || '';

  return (
    <html lang={locale} className={`h-full bg-brand-navy ${outfit.variable}`}>
      <head>

        {/* Favicon 根據語系切換（ico 格式） */}
        {locale === 'en' ? (
          <link rel="icon" href="/eyes2.ico" type="image/x-icon" />
        ) : (
          <link rel="icon" href="/eyes1.ico" type="image/x-icon" />
        )}
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen flex flex-col text-white font-body">
        {/* Plausible Analytics — loaded after interactive (non-blocking) */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            strategy="afterInteractive"
            nonce={nonce}
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src={process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.js'}
          />
        )}
        <NextIntlClientProvider messages={messages}>
          {/* Skip to main content link for keyboard/screen reader users */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-brand-pink focus:text-white focus:rounded-lg focus:outline-none"
          >
            {t('skipToMain')}
          </a>
          <LangToggle />
          <FloatingInstagram />
          <Header />
          <main id="main-content" className="flex-1">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
