import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { BLUR_POSTER } from '@/lib/constants';
import { locales, setRequestLocale } from '@/lib/i18n';
import { pageSEO, getLocaleAlternates } from '@/lib/seo';
import type { Metadata } from 'next';

// Counter is a client component below the fold; lazy-load it
const Counter = dynamic(() => import('@/components/Counter'), { ssr: false });

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: pageSEO.events.title,
    description: pageSEO.events.description,
    openGraph: { title: pageSEO.events.title, description: pageSEO.events.description, locale: locale === 'zh' ? 'zh_TW' : 'en_US' },
    alternates: getLocaleAlternates('events', locale),
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Event Section Component - Server Component
function EventSection({
  image,
  title,
  description,
  signupUrl,
  signupText = 'Sign Up',
  imagePosition = 'left',
  priority = false,
  ctaClass,
}: {
  image: string;
  title: string;
  description: React.ReactNode;
  signupUrl?: string;
  signupText?: string;
  imagePosition?: 'left' | 'right';
  priority?: boolean;
  ctaClass?: string;
}) {
  const imageOrderClass = imagePosition === 'left' ? 'order-1 lg:order-1' : 'order-1 lg:order-2';
  const contentOrderClass = imagePosition === 'left' ? 'order-2 lg:order-2' : 'order-2 lg:order-1';

  const imageBlock = (
    <div className={`w-full lg:w-5/12 flex justify-center ${imageOrderClass}`}>
      <div className="relative w-full max-w-[360px] sm:max-w-[400px] lg:max-w-none rounded-xl overflow-hidden shadow-xl" style={{ aspectRatio: '4/5' }}>
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          loading={priority ? 'eager' : 'lazy'}
          placeholder="blur"
          blurDataURL={BLUR_POSTER}
        />
      </div>
    </div>
  );

  const contentBlock = (
    <div className={`w-full lg:flex-1 flex flex-col justify-center ${contentOrderClass}`}>
      <h3 className="text-2xl md:text-3xl font-bold text-white font-outfit">
        {title}
      </h3>
      <p className="mt-6 text-white/80 leading-relaxed whitespace-pre-line text-lg font-outfit">
        {description}
      </p>
      {signupUrl && (
        <div className="mt-8">
          <Link
            href={signupUrl}
            className={ctaClass || "inline-flex items-center px-8 py-3 rounded-full bg-brand-pink text-white font-semibold hover:brightness-110 transition-all uppercase tracking-wider text-[15px] md:text-base"}
            prefetch={false}
          >
            {signupText}
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-center lg:justify-center">
      {imagePosition === 'left' ? (
        <>
          {imageBlock}
          {contentBlock}
        </>
      ) : (
        <>
          {contentBlock}
          {imageBlock}
        </>
      )}
    </div>
  );
}

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('events');
  const ctaClass = locale === 'en' ? "inline-flex min-h-11 items-center justify-center rounded-full bg-brand-pink px-5 sm:px-7 py-2.5 sm:py-3 font-semibold text-white shadow font-outfit transition-all text-sm sm:text-base uppercase tracking-wider hover:brightness-110" : "inline-flex min-h-11 items-center justify-center rounded-full bg-brand-pink px-8 sm:px-9 py-2.5 sm:py-3 font-semibold text-white shadow transition-all text-base sm:text-lg tracking-[0.24em] sm:tracking-[0.3em] hover:brightness-110";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bookdigest.club';
  const eventsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Book Digest Events',
    itemListElement: [
      {
        '@type': 'Event',
        name: t('taiwanTitle'),
        description: t('taiwanDesc'),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventSchedule: { '@type': 'Schedule', repeatFrequency: 'P1M', byDay: 'https://schema.org/Saturday' },
        location: { '@type': 'Place', name: 'Taipei, Taiwan', address: { '@type': 'PostalAddress', addressLocality: 'Taipei', addressCountry: 'TW' } },
        organizer: { '@type': 'Organization', name: 'Book Digest', url: siteUrl },
        url: `${siteUrl}/${locale}/signup?location=TW`,
      },
      {
        '@type': 'Event',
        name: t('nlTitle'),
        description: t('nlDesc'),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventSchedule: { '@type': 'Schedule', repeatFrequency: 'P1M', byDay: 'https://schema.org/Saturday' },
        location: { '@type': 'Place', name: 'Netherlands', address: { '@type': 'PostalAddress', addressCountry: 'NL' } },
        organizer: { '@type': 'Organization', name: 'Book Digest', url: siteUrl },
        url: `${siteUrl}/${locale}/signup?location=NL`,
      },
      {
        '@type': 'Event',
        name: t('onlineTitle'),
        description: t.raw('onlineDesc').replace(/<[^>]+>/g, ''),
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
        eventSchedule: { '@type': 'Schedule', repeatFrequency: 'P1M' },
        location: { '@type': 'VirtualLocation', url: `${siteUrl}/${locale}/engclub` },
        organizer: { '@type': 'Organization', name: 'Book Digest', url: siteUrl },
        url: `${siteUrl}/${locale}/engclub`,
      },
    ],
  };

  return (
    <section className="bg-brand-navy text-white min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventsJsonLd).replace(/<\/script>/gi, '<\\/script>') }}
      />
      <div className="mx-auto max-w-5xl px-6 lg:px-16 py-16">
        {/* Stats Counters - Client Component for animation */}
        {(() => {
          const startDate = new Date('2020-07-31');
          const now = new Date();
          const readingDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          
          const baseDate = new Date('2026-03-01');
          const monthsDiff = (now.getFullYear() - baseDate.getFullYear()) * 12 + (now.getMonth() - baseDate.getMonth());
          const safeMonthsDiff = Math.max(0, monthsDiff);
          
          const clubsHeld = 78 + safeMonthsDiff * 2;
          const readersJoined = 300 + safeMonthsDiff * 15;
          return (
            <div className="grid grid-cols-3 gap-2 min-[420px]:gap-6 mb-16" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <div className="min-[420px]:translate-x-4 min-w-0"><Counter target={readingDays} label={t('readingDays')} /></div>
              <div className="min-w-0"><Counter target={clubsHeld} label={t('clubsHeld')} /></div>
              <div className="min-[420px]:-translate-x-4 min-w-0"><Counter target={readersJoined} label={t('readersJoined')} /></div>
            </div>
          );
        })()}

        {/* Taiwan Book Club */}
        <div className="py-12">
          <EventSection
            image="/images/elements/poster_202603_taiwan.webp"
            title={t('taiwanTitle')}
            description={t('taiwanDesc')}
            signupUrl={`/${locale}/signup?location=TW`}
            signupText={t('signUp')}
            imagePosition="left"
            priority={true}
            ctaClass={ctaClass}
          />
        </div>

        <div className="my-4 h-px bg-gradient-to-r from-transparent via-brand-pink/50 to-transparent" />

        {/* Online English Book Club */}
        <div className="py-12">
          <EventSection
            image="/images/elements/poster_202604_en_online.webp"
            title={t('onlineTitle')}
            description={t.rich('onlineDesc', { level: (chunks) => <strong className="font-bold text-base block mt-3">{chunks}</strong> })}
            signupUrl={`/${locale}/engclub`}
            signupText={t('signUp')}
            imagePosition="right"
            ctaClass={ctaClass}
          />
        </div>

        <div className="my-4 h-px bg-gradient-to-r from-transparent via-brand-pink/50 to-transparent" />

        {/* Netherlands Book Club */}
        <div className="py-12">
          <EventSection
            image="/images/elements/AD-15.webp"
            title={t('nlTitle')}
            description={t('nlDesc')}
            signupUrl={`/${locale}/signup?location=NL`}
            signupText={t('signUp')}
            imagePosition="left"
            ctaClass={ctaClass}
          />
        </div>

        <div className="my-4 h-px bg-gradient-to-r from-transparent via-brand-pink/50 to-transparent" />

        {/* Digital Detox */}
        <div id="detox" className="py-12">
          <EventSection
            image="/images/elements/AD-17.webp"
            title={t('detoxTitle')}
            description={t('detoxDesc')}
            signupUrl={`/${locale}/detox`}
            signupText={t('signUp')}
            imagePosition="right"
            ctaClass={ctaClass}
          />
        </div>
      </div>
    </section>
  );
}
