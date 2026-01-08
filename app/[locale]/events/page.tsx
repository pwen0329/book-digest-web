import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import Image from 'next/image';
import stats from '@/data/stats.json';
import Counter from '@/components/Counter';
import { BLUR_POSTER } from '@/lib/constants';
import { locales, setRequestLocale } from '@/lib/i18n';

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
}: {
  image: string;
  title: string;
  description: string;
  signupUrl?: string;
  signupText?: string;
  imagePosition?: 'left' | 'right';
  priority?: boolean;
}) {
  const imageBlock = (
    <div className="w-full lg:w-1/2">
      <div className="relative rounded-2xl overflow-hidden shadow-xl" style={{ aspectRatio: '750/570' }}>
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
    <div className="w-full lg:w-1/2 flex flex-col justify-center">
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
            className="inline-flex items-center px-8 py-3 rounded-full bg-brand-pink text-white font-semibold hover:brightness-110 transition-all uppercase tracking-wider text-sm"
            prefetch={false}
          >
            {signupText}
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-center">
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

  return (
    <section className="bg-brand-navy text-white min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* Stats Counters - Client Component for animation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-8 mb-16">
          <Counter target={stats.readingDays} label={t('readingDays')} />
          <Counter target={stats.clubsHeld} label={t('clubsHeld')} />
          <Counter target={stats.readersJoined} label={t('readersJoined')} />
        </div>

        {/* Taiwan Book Club */}
        <div className="py-12">
          <EventSection
            image="/images/elements/AD-16.png"
            title={t('taiwanTitle')}
            description={t('taiwanDesc')}
            signupUrl="/signup?location=TW"
            signupText={t('signUp')}
            imagePosition="left"
            priority={true}
          />
        </div>

        {/* Decorative Line */}
        <div className="relative h-px my-4">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-pink/50 to-transparent" />
        </div>

        {/* Netherlands Book Club */}
        <div className="py-12">
          <EventSection
            image="/images/elements/AD-15.png"
            title={t('nlTitle')}
            description={t('nlDesc')}
            signupUrl="/signup?location=NL"
            signupText={t('signUp')}
            imagePosition="right"
          />
        </div>

        {/* Decorative Line */}
        <div className="relative h-px my-4">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-pink/50 to-transparent" />
        </div>

        {/* Digital Detox */}
        <div id="detox" className="py-12">
          <EventSection
            image="/images/elements/AD-17.png"
            title={t('detoxTitle')}
            description={t('detoxDesc')}
            signupUrl="/detox"
            signupText={t('signUp')}
            imagePosition="left"
          />
        </div>
      </div>
    </section>
  );
}
