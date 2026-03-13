'use client';

import type { HTMLAttributes } from 'react';
import { memo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { buildLocalizedPath } from '@/lib/locale-switch';

type LangToggleProps = {
  className?: string;
  buttonClassName?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'className'>;

export default memo(function LangToggle({ className = '', buttonClassName = '', ...props }: LangToggleProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = (newLocale: 'en' | 'zh') => {
    if (newLocale === locale) return;

    const search = typeof window === 'undefined' ? '' : window.location.search;
    const hash = typeof window === 'undefined' ? '' : window.location.hash;
    const searchParams = search ? new URLSearchParams(search) : undefined;
    router.replace(buildLocalizedPath(pathname, newLocale, searchParams, hash), { scroll: false });
  };

  return (
    <div
      className={`flex items-center ${className}`.trim()}
      {...props}
    >
      <div
        className={`inline-flex rounded-full border border-white/20 p-0.5 bg-brand-navy/90 backdrop-blur shadow-lg ${buttonClassName}`.trim()}
        role="group"
        aria-label="Language selector"
        data-ready="true"
      >
        <button
          type="button"
          aria-label="Switch to English"
          aria-pressed={locale === 'en'}
          onClick={() => switchLocale('en')}
          className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full font-medium font-outfit uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
            locale === 'en'
              ? 'bg-brand-pink text-brand-navy'
              : 'text-white hover:bg-white/10'
          }`}
        >
          EN
        </button>
        <button
          type="button"
          aria-label="Switch to Chinese"
          aria-pressed={locale === 'zh'}
          onClick={() => switchLocale('zh')}
          className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full font-medium font-outfit uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
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
