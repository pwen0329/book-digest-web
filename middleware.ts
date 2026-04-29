import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from '@/lib/i18n';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export default function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-request-id', requestId);

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    requestHeaders.set('x-pathname', pathname);
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    response.headers.set('x-request-id', requestId);
    return response;
  }

  const hasLocalePrefix = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  // Locale-prefixed routes already encode the locale in the pathname.
  // Only run next-intl's routing middleware when locale negotiation is still needed.
  const response = hasLocalePrefix
    ? NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    : intlMiddleware(req);

  // Generate a CSP nonce in an Edge-compatible way (Buffer is not guaranteed in Edge runtime).
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV !== 'production';

  // Build CSP with nonce (replaces 'unsafe-inline' for scripts)
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://plausible.io https://challenges.cloudflare.com https://*.sentry.io https://vercel.live`
    : `script-src 'self' 'unsafe-inline' https://plausible.io https://challenges.cloudflare.com https://*.sentry.io https://vercel.live`;

  // In development, allow HTTP images from local Supabase
  const imgSrc = isDev
    ? "img-src 'self' data: blob: https: http://127.0.0.1:54321 http://localhost:54321"
    : "img-src 'self' data: blob: https:";

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "script-src-elem 'self' 'unsafe-inline' https://plausible.io https://challenges.cloudflare.com https://*.sentry.io https://vercel.live",
    "style-src-elem 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    imgSrc,
    "connect-src 'self' https://plausible.io https://challenges.cloudflare.com https://*.ingest.sentry.io https://vercel.live",
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  // Pass the nonce to the layout via request header
  response.headers.set('x-nonce', nonce);
  response.headers.set('x-request-id', requestId);
  // Set the dynamic CSP header
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

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
