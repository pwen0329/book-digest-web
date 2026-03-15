import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import FloatingInstagram from '@/components/FloatingInstagram';
import FloatingLangToggle from '@/components/FloatingLangToggle';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { defaultViewport, getLocaleMetadata } from '@/lib/seo';
import { NextIntlClientProvider } from 'next-intl';
import { Outfit } from 'next/font/google';
import { locales, type Locale, setRequestLocale } from '@/lib/i18n';

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
  const headerStore = headers();
  const nonce = headerStore.get('x-nonce') || '';
  
  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Enable static rendering for this locale
  setRequestLocale(locale);

  const messages = (await import(`../../messages/${locale}.json`)).default;
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  return (
    <>
      {nonce ? <meta name="csp-nonce" content={nonce} /> : null}
      {/* Plausible Analytics — loaded after interactive (non-blocking) */}
      {plausibleDomain && (
        <Script
          strategy="afterInteractive"
          nonce={nonce || undefined}
          data-domain={plausibleDomain}
          src={process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.js'}
        />
      )}
      <NextIntlClientProvider messages={messages}>
        <div className={`min-h-screen bg-brand-navy text-white font-body ${outfit.variable}`}>
          {/* Skip to main content link for keyboard/screen reader users */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-brand-pink focus:text-white focus:rounded-lg focus:outline-none"
          >
            {messages.common.skipToMain}
          </a>
          <div className="min-h-screen flex flex-col">
            <FloatingInstagram />
            <FloatingLangToggle />
            <Header />
            <main id="main-content" className="flex-1">{children}</main>
            <Footer locale={locale as Locale} messages={messages.footer} />
          </div>
        </div>
      </NextIntlClientProvider>
    </>
  );
}
