import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LangToggle from '@/components/LangToggle';
import { defaultSEO, defaultViewport } from '@/lib/seo';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
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

export const metadata: Metadata = defaultSEO;
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

  return (
    <html lang={locale} className={`h-full bg-brand-navy ${outfit.variable} ${notoSansTC.variable}`}>
      <head>
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
        {/* Alternate languages */}
        <link rel="alternate" hrefLang="en" href="https://bookdigest.club/en" />
        <link rel="alternate" hrefLang="zh-TW" href="https://bookdigest.club/zh" />
        <link rel="alternate" hrefLang="x-default" href="https://bookdigest.club" />
      </head>
      <body className="min-h-screen flex flex-col text-white font-body">
        <NextIntlClientProvider messages={messages}>
          <LangToggle />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
