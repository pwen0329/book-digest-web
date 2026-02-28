import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LangToggle from '@/components/LangToggle';
import FloatingInstagram from '@/components/FloatingInstagram';
import { defaultViewport, getLocaleMetadata } from '@/lib/seo';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Outfit, Noto_Sans_TC } from 'next/font/google';
import { locales, type Locale, setRequestLocale } from '@/lib/i18n';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

// Noto Sans TC with optimized CJK subset loading
// Only load Traditional Chinese characters commonly used in the UI
const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-tc',
  display: 'swap',
  // Preload only the most common characters for faster initial load
  preload: true,
  // Use font-display: swap for better perceived performance
  adjustFontFallback: true,
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

  return (
    <html lang={locale} className={`h-full bg-brand-navy ${outfit.variable} ${notoSansTC.variable}`}>
      <head>
        {/* Plausible Analytics (privacy-friendly, no cookies) */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src={process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.js'}
          />
        )}

        {/* Preconnect to critical resources (performance optimization) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        
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
