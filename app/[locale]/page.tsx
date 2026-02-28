import HomeHero from '@/components/HomeHero';
import BookWall from '@/components/BookWall';
import WhyUs from '@/components/WhyUs';
import SectionDivider from '@/components/SectionDivider';
import { setRequestLocale } from '@/lib/i18n';
import { locales } from '@/lib/i18n';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bookdigest.club';

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Book Digest',
  url: siteUrl,
  logo: `${siteUrl}/logo.svg`,
  description: 'A space to rest, read, and reconnect — one page at a time.',
  sameAs: [
    'https://www.instagram.com/bookdigest.club/',
  ],
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/<\/script>/gi, '<\\/script>') }}
      />
      <HomeHero />

      {/* Section Divider */}
      <SectionDivider color="white" className="mx-auto max-w-6xl px-6" />

      {/* Book Wall - showing all book covers */}
      <BookWall />

      {/* Section Divider */}
      <SectionDivider color="white" className="mx-auto max-w-6xl px-6" />

      {/* Why Us section */}
      <WhyUs />
    </>
  );
}
