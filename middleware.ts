import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from '@/lib/i18n';

export default createMiddleware({
  // A list of all locales that are supported
  locales,
  // Used when no locale matches
  defaultLocale,
  // Always add locale prefix to enable proper locale switching
  localePrefix: 'always',
});

export const config = {
  // Match all pathnames except for
  // - API routes
  // - Static files (images, etc.)
  // - Next.js internals
  matcher: [
    // Match all pathnames except for
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // However, match all pathnames within `/api`, except for `/api/...`
  ],
};
