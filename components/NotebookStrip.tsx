import Link from 'next/link';
import Image from 'next/image';
import { getTranslations, getLocale } from 'next-intl/server';

export default async function NotebookStrip() {
  const tModal = await getTranslations('modal');
  const locale = await getLocale();
  const frames = [1, 2, 3, 4, 5, 6].map((n) => `/images/notebook/notebook-0${n}.png`);
  return (
    <section className="bg-brand-navy">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
            {frames.map((src) => (
              <div key={src} className="relative aspect-[4/5] overflow-hidden rounded-xl bg-white/10">
                <Image src={src} alt="Notebook frame" fill sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16vw" className="object-cover" />
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link href="/events#detox" className={`inline-flex items-center rounded-full bg-brand-pink px-5 py-2.5 font-semibold text-white hover:brightness-110 transition-all ${locale === 'zh' ? 'tracking-widest' : ''}`}>{tModal('imIn')}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
