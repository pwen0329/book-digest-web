'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

type ActivityTab = 'TW' | 'EN' | 'NL' | 'DETOX';

const tabHref = (locale: string, tab: ActivityTab) => {
  if (tab === 'EN') return `/${locale}/engclub`;
  if (tab === 'DETOX') return `/${locale}/detox`;
  return `/${locale}/signup?location=${tab}`;
};

export default function ActivitySignupTabs({ activeTab }: { activeTab: ActivityTab }) {
  const locale = useLocale();
  const t = useTranslations('events');

  const tabs: Array<{ id: ActivityTab; label: string }> = [
    { id: 'TW', label: t('taiwanTitle') },
    { id: 'EN', label: t('onlineTitle') },
    { id: 'NL', label: t('nlTitle') },
    { id: 'DETOX', label: t('detoxTitle') },
  ];

  return (
    <nav aria-label="Activity signup tabs" className="mb-8">
      <div className="flex flex-wrap gap-2 rounded-2xl bg-white/10 p-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tabHref(locale, tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all md:px-5 ${
                isActive
                  ? 'bg-brand-pink text-brand-navy shadow'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              prefetch={false}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}