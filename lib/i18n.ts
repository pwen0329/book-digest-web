import { getRequestConfig } from 'next-intl/server';
import { setRequestLocale as nextIntlSetRequestLocale } from 'next-intl/server';

export const locales = ['en', 'zh'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'zh';

/**
 * Get all supported locales.
 * Centralized function to replace hardcoded ['en', 'zh'] arrays throughout the codebase.
 *
 * @returns Array of supported locale codes
 */
export function getLocales(): readonly Locale[] {
  return locales;
}

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
