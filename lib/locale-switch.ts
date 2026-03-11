import type { ReadonlyURLSearchParams } from 'next/navigation';

const LOCALE_PREFIXES = ['/en', '/zh'] as const;

export function buildLocalizedPath(
  pathname: string,
  locale: 'en' | 'zh',
  searchParams?: URLSearchParams | ReadonlyURLSearchParams | null,
  hash = '',
): string {
  let pathWithoutLocale = pathname;

  for (const prefix of LOCALE_PREFIXES) {
    if (pathname === prefix) {
      pathWithoutLocale = '/';
      break;
    }

    if (pathname.startsWith(`${prefix}/`)) {
      pathWithoutLocale = pathname.slice(prefix.length);
      break;
    }
  }

  const normalizedPath = pathWithoutLocale === '/' ? '' : pathWithoutLocale;
  const query = searchParams?.toString();
  const normalizedHash = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';

  return `/${locale}${normalizedPath}${query ? `?${query}` : ''}${normalizedHash}`;
}