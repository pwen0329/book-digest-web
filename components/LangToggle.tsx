'use client';

import type { HTMLAttributes } from 'react';
import { memo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { buildLocalizedPath } from '@/lib/locale-switch';

type LangToggleProps = {
  className?: string;
  buttonClassName?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'className'>;

export default memo(function LangToggle({ className = '', buttonClassName = '', ...props }: LangToggleProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const englishPath = buildLocalizedPath(pathname, 'en', searchParams);
  const chinesePath = buildLocalizedPath(pathname, 'zh', searchParams);

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
        <a
          href={englishPath}
          aria-label="Switch to English"
          aria-current={locale === 'en' ? 'page' : undefined}
          className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full font-medium font-outfit uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
            locale === 'en'
              ? 'bg-brand-pink text-brand-navy'
              : 'text-white hover:bg-white/10'
          }`}
        >
          EN
        </a>
        <a
          href={chinesePath}
          aria-label="Switch to Chinese"
          aria-current={locale === 'zh' ? 'page' : undefined}
          className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full font-medium font-outfit uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
            locale === 'zh'
              ? 'bg-brand-pink text-brand-navy'
              : 'text-white hover:bg-white/10'
          }`}
        >
          中文
        </a>
      </div>
    </div>
  );
});
