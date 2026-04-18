/**
 * Centralized environment variable configuration
 *
 * This module provides type-safe access to environment variables with defaults.
 * Split into client-side (NEXT_PUBLIC_*) and server-side variables.
 */

// ============================================================================
// Client-side Environment Variables (NEXT_PUBLIC_*)
// These are safe to use in browser code
// ============================================================================

export const CLIENT_ENV = {
  /**
   * Public site URL used for canonical URLs, OG tags, sitemaps, etc.
   * @default 'https://bookdigest.dev'
   */
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://bookdigest.dev',

  /**
   * Plausible Analytics script source
   * @default 'https://plausible.io/js/script.js'
   */
  PLAUSIBLE_SRC: process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.js',

  /**
   * Turnstile (Cloudflare) site key for bot verification
   * @default ''
   */
  TURNSTILE_SITEKEY: process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY || '',
} as const;

// ============================================================================
// Server-side Environment Variables
// These should NEVER be used in client components or exposed to the browser
// ============================================================================

// Supabase Configuration
export const SUPABASE_CONFIG = {
  URL: process.env.SUPABASE_URL || null,
  SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
  STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'admin-assets',

  // Table names
  TABLES: {
    BOOKS: process.env.SUPABASE_BOOKS_TABLE || 'books',
    EVENTS: process.env.SUPABASE_EVENTS_TABLE || 'events',
    EVENT_TYPES: process.env.SUPABASE_EVENT_TYPES_TABLE || 'event_types',
    REGISTRATIONS: process.env.SUPABASE_REGISTRATIONS_TABLE || 'registrations',
    SETTINGS: process.env.SUPABASE_SETTINGS_TABLE || 'settings',
    VENUES: process.env.SUPABASE_VENUES_TABLE || 'venues',
  },
} as const;

// Email Configuration
export const EMAIL_CONFIG = {
  RESEND_API_KEY: process.env.RESEND_API_KEY || null,
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@bookdigest.app',
  REGISTRATION_EMAIL_FROM: process.env.REGISTRATION_EMAIL_FROM || null,
  REGISTRATION_EMAIL_REPLY_TO: process.env.REGISTRATION_EMAIL_REPLY_TO || null,
  OUTBOX_FILE: process.env.EMAIL_OUTBOX_FILE || null,
} as const;

// Admin Configuration
export const ADMIN_CONFIG = {
  PASSWORD: process.env.ADMIN_PASSWORD || process.env.ADMIN_API_SECRET || null,
  SESSION_SECRET: process.env.ADMIN_SESSION_SECRET || null,
} as const;

// Security Configuration
export const SECURITY_CONFIG = {
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',

  // Rate limiting
  RATE_LIMIT_MAX_REQUESTS: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10),
} as const;

// Legacy/Fallback Configuration
export const LEGACY_CONFIG = {
  /**
   * Legacy BASE_URL fallback for local development
   * @deprecated Use CLIENT_ENV.SITE_URL instead
   */
  BASE_URL: process.env.BASE_URL || null,
} as const;
