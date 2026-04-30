import Link from 'next/link';
import Image from 'next/image';
import type { Locale } from '@/lib/i18n';

type FooterMessages = {
  events: string;
  bookClub: string;
  unplugProject: string;
  getInvolved: string;
  beAHost: string;
  aboutUs: string;
  ourStory: string;
  instagram: string;
  podcast: string;
  helpSupport: string;
  contactUs: string;
  terms: string;
  privacy: string;
  copyright: string;
};

export default function Footer({ locale, messages }: { locale: Locale; messages: FooterMessages }) {
  const isZh = locale === 'zh';
  return (
    <footer className="bg-brand-navy">
      {/* Top divider with centered icon */}
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-white/30" />
          <Image
            src="/images/logo/footer-icon.png"
            alt=""
            width={170}
            height={18}
            sizes="170px"
            className="h-auto w-[170px]"
            aria-hidden="true"
          />
          <div className="h-px flex-1 bg-white/30" />
        </div>
      </div>

      {/* Four-column navigation - mobile 橫向（2欄），桌面 4 欄 */}
      <div className={`mx-auto max-w-6xl px-6 py-10 grid gap-8 grid-cols-2 md:grid-cols-4 text-sm text-white/80 font-outfit ${isZh ? 'text-left' : ''}`}>
        <div>
          <div className="font-semibold text-white font-outfit uppercase tracking-wider text-xs">{messages.events}</div>
          <ul className="mt-3 space-y-2">
            <li><Link className="hover:underline hover:text-brand-pink transition-colors" href={`/${locale}/events/TW`}>{messages.bookClub}</Link></li>
            <li><Link className="hover:underline hover:text-brand-pink transition-colors" href={`/${locale}/events/TW?type=DETOX`}>{messages.unplugProject}</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-white font-outfit uppercase tracking-wider text-xs">{messages.getInvolved}</div>
          <ul className="mt-3 space-y-2">
            <li><Link className="hover:underline hover:text-brand-pink transition-colors" href={`/${locale}/joinus`}>{messages.beAHost}</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-white font-outfit uppercase tracking-wider text-xs">{messages.aboutUs}</div>
          <ul className="mt-3 space-y-2">
            <li><Link className="hover:underline hover:text-brand-pink transition-colors" href={`/${locale}/about`}>{messages.ourStory}</Link></li>
            <li><a className="hover:underline hover:text-brand-pink transition-colors" href="https://www.instagram.com/bookdigest_tw/" target="_blank" rel="noopener noreferrer">{messages.instagram}</a></li>
            <li><a className="hover:underline hover:text-brand-pink transition-colors" href="https://podcasts.apple.com/podcast/1801844059" target="_blank" rel="noopener noreferrer">{messages.podcast}</a></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-white font-outfit uppercase tracking-wider text-xs">{messages.helpSupport}</div>
          <ul className="mt-3 space-y-2">
            <li><a className="hover:underline hover:text-brand-pink transition-colors" href="mailto:bookdigest2020@gmail.com?subject=Book%20Digest%20Inquiry">{messages.contactUs}</a></li>
            <li><Link className="hover:underline hover:text-brand-pink transition-colors" href={`/${locale}/terms`}>{messages.terms}</Link></li>
            <li><Link className="hover:underline hover:text-brand-pink transition-colors" href={`/${locale}/privacy`}>{messages.privacy}</Link></li>
          </ul>
        </div>
      </div>

      {/* Bottom pink copyright bar - thinner */}
      <div className="bg-brand-pink text-brand-navy text-center text-[10px] py-0.5 font-outfit">{messages.copyright}</div>
    </footer>
  );
}
