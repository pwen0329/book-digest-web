import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from '@/lib/i18n';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export default function middleware(req: NextRequest) {
  // Run the intl middleware first
  const response = intlMiddleware(req);

  // Generate a nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV !== 'production';

  // Build CSP with nonce (replaces 'unsafe-inline' for scripts)
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' 'strict-dynamic' https://plausible.io https://challenges.cloudflare.com https://*.sentry.io`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://plausible.io https://challenges.cloudflare.com https://*.sentry.io`;

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src-elem 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://plausible.io https://challenges.cloudflare.com https://*.ingest.sentry.io",
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  // Pass the nonce to the layout via request header
  response.headers.set('x-nonce', nonce);
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
