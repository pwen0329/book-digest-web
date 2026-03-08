import { getRequestConfig } from 'next-intl/server';
import { setRequestLocale as nextIntlSetRequestLocale } from 'next-intl/server';

export const locales = ['en', 'zh'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'zh';

// Re-export setRequestLocale for use in page components to enable static rendering
export const setRequestLocale = nextIntlSetRequestLocale;

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;

  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default,
  };
});
