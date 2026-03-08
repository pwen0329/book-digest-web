import createNextIntlPlugin from 'next-intl/plugin';
import bundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./lib/i18n.ts');
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});
const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_AUTH_TOKEN);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep default `.next`, but allow override in restricted environments.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // CSP is now set dynamically in middleware.ts (nonce-based)
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  // Image optimization settings
  images: {
    // Enable modern image formats (AVIF preferred, WebP fallback)
    formats: ['image/avif', 'image/webp'],
    // Define device size breakpoints
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Define image sizes (for sizes attribute)
    imageSizes: [16, 32, 48, 64, 96, 128, 192, 256],
    // Configure external image sources here
    remotePatterns: [
      { protocol: 'https', hostname: 'bookdigest.club' },
      { protocol: 'https', hostname: '*.bookdigest.club' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.notion.so' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
    ],
  },
  // Bundle splitting optimization
  experimental: {
    // Optimize specific package imports (tree-shaking)
    optimizePackageImports: ['lucide-react', 'next-intl'],
  },
  // Modular imports optimization
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
  // Enable polling for file changes in development (useful in Docker/WSL/VM)
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay before rebuilding
      };
    } else {
      config.cache = false;
    }
    return config;
  },
};

const baseConfig = withBundleAnalyzer(withNextIntl(nextConfig));

export default sentryEnabled
  ? withSentryConfig(baseConfig, {
      // Suppress source map upload warnings when no auth token is set
      silent: !process.env.SENTRY_AUTH_TOKEN,
      // Disable source map upload in dev / when no token
      disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
      disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
    })
  : baseConfig;
