'use client';

import { memo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

export default memo(function LangToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = (newLocale: string) => {
    // Remove locale prefix from pathname
    let pathWithoutLocale = pathname;
    if (pathname.startsWith('/en/')) {
      pathWithoutLocale = pathname.slice(3);
    } else if (pathname.startsWith('/zh/')) {
      pathWithoutLocale = pathname.slice(3);
    } else if (pathname === '/en' || pathname === '/zh') {
      pathWithoutLocale = '/';
    }
    
    const newPath = newLocale === 'en' ? `/en${pathWithoutLocale}` : `/zh${pathWithoutLocale}`;
    router.push(newPath);
  };

  return (
    <div
      className="fixed right-2 top-[calc(env(safe-area-inset-top)+6.5rem)] md:top-2 md:right-4 z-40 flex items-start"
    >
      <div
        className="inline-flex rounded-full border border-white/20 p-0.5 bg-brand-navy/90 backdrop-blur text-[10px] md:text-xs shadow-lg"
        role="group"
        aria-label="Language selector"
      >
      <button
        aria-pressed={locale === 'en'}
        onClick={() => switchLocale('en')}
        className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full font-medium font-outfit uppercase tracking-wider transition-colors ${
          locale === 'en'
            ? 'bg-brand-pink text-brand-navy'
            : 'text-white hover:bg-white/10'
        }`}
      >
        EN
      </button>
      <button
        aria-pressed={locale === 'zh'}
        onClick={() => switchLocale('zh')}
        className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full font-medium font-outfit uppercase tracking-wider transition-colors ${
          locale === 'zh'
            ? 'bg-brand-pink text-brand-navy'
            : 'text-white hover:bg-white/10'
        }`}
      >
        中文
      </button>
      </div>
    </div>
  );
});
