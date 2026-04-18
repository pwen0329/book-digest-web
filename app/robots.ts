import type { MetadataRoute } from 'next';
import { CLIENT_ENV } from '@/lib/env';

const siteUrl = CLIENT_ENV.SITE_URL;

export default function robots(): MetadataRoute.Robots {
  // Block indexing on non-production environments
  const isProduction = siteUrl === 'https://bookdigest.dev';

  if (!isProduction) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
