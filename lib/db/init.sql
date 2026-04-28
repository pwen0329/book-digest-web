-- ============================================================================
-- Database Initialization Script for Book Digest Web
-- ============================================================================
-- This script creates all tables, indexes, triggers, and constraints needed
-- to run the application. Contains NO seed data.
--
-- Run with: psql -h <host> -U <user> -d <database> -f lib/db/init.sql
-- For test data, run: psql -h <host> -U <user> -d <database> -f lib/db/test_seed.sql
-- ============================================================================

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Trigger function to automatically update updated_at column
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- TABLE: event_types (reference table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_types (
  code VARCHAR(50) PRIMARY KEY,
  name_en VARCHAR(100) NOT NULL,
  name_zh VARCHAR(100) NOT NULL,
  online_possible BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE public.event_types IS 'Reference table for event types with bilingual names';
COMMENT ON COLUMN public.event_types.online_possible IS 'Whether this event type can be held online';

-- ============================================================================
-- TABLE: books
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.books (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  sort_order INTEGER,

  -- Core fields
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  read_date DATE,

  -- English translations
  title_en TEXT,
  author_en TEXT,

  -- Content
  summary TEXT,
  summary_en TEXT,
  reading_notes TEXT,
  reading_notes_en TEXT,

  -- Arrays
  discussion_points TEXT[],
  discussion_points_en TEXT[],
  tags TEXT[],

  -- Cover images
  cover_url TEXT,
  cover_url_en TEXT,
  cover_blur_data_url TEXT,
  cover_blur_data_url_en TEXT,

  -- JSONB for nested data
  links JSONB,
  additional_covers JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_books_slug ON public.books(slug);
CREATE INDEX IF NOT EXISTS idx_books_author ON public.books(author);
CREATE INDEX IF NOT EXISTS idx_books_read_date ON public.books(read_date DESC);
CREATE INDEX IF NOT EXISTS idx_books_tags ON public.books USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_books_sort_order ON public.books(sort_order);

-- ============================================================================
-- TABLE: event_signup_intros (templates for event signup intro messages)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_signup_intros (
  name TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  content_en TEXT NOT NULL,
  is_free BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.events (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  event_type_code VARCHAR(50) NOT NULL REFERENCES public.event_types(code) ON DELETE RESTRICT,

  -- Inline venue fields (no separate venue table)
  venue_name TEXT,
  venue_name_en TEXT,
  venue_capacity INTEGER NOT NULL,
  venue_address TEXT,
  venue_location TEXT NOT NULL CHECK (venue_location IN ('TW', 'NL', 'ONLINE')),

  -- Bilingual content
  title TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  description_en TEXT,

  -- Scheduling (all in UTC)
  event_date TIMESTAMPTZ NOT NULL,
  registration_opens_at TIMESTAMPTZ NOT NULL,
  registration_closes_at TIMESTAMPTZ NOT NULL,

  -- Related book (optional)
  book_id BIGINT REFERENCES public.books(id) ON DELETE SET NULL,

  -- Cover images
  cover_url TEXT,
  cover_url_en TEXT,
  cover_blur_data_url TEXT,
  cover_blur_data_url_en TEXT,

  -- Payment fields
  payment_amount INTEGER NOT NULL DEFAULT 0,
  payment_currency TEXT NOT NULL DEFAULT 'TWD',

  -- Signup intro template
  intro_template_name TEXT NOT NULL REFERENCES public.event_signup_intros(name) ON DELETE RESTRICT,

  -- Status
  is_published BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(event_type_code);
CREATE INDEX IF NOT EXISTS idx_events_location ON public.events(venue_location);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_published ON public.events(is_published);
CREATE INDEX IF NOT EXISTS idx_events_book ON public.events(book_id);
CREATE INDEX IF NOT EXISTS idx_events_intro_template ON public.events(intro_template_name);

-- ============================================================================
-- TABLE: registrations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.registrations (
  id TEXT PRIMARY KEY,
  event_id BIGINT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('zh', 'en')),
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  profession TEXT NOT NULL,
  email TEXT NOT NULL,
  instagram TEXT,
  referral TEXT NOT NULL,
  referral_other TEXT,
  bank_account TEXT,
  visitor_id TEXT,
  request_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created', 'pending', 'confirmed', 'cancelled')),
  audit_trail JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON public.registrations (event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON public.registrations (status);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON public.registrations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_updated_at ON public.registrations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_timestamp ON public.registrations (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_request_id ON public.registrations (request_id);

-- Foreign key constraints
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS fk_registrations_event;
ALTER TABLE public.registrations
  ADD CONSTRAINT fk_registrations_event
  FOREIGN KEY (event_id)
  REFERENCES events(id)
  ON DELETE RESTRICT;

-- Trigger
DROP TRIGGER IF EXISTS registrations_set_updated_at ON public.registrations;
CREATE TRIGGER registrations_set_updated_at
BEFORE UPDATE ON public.registrations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on all tables to follow Supabase best practices.
-- Service role key bypasses RLS, so these policies are primarily for:
-- 1. Security posture (defense in depth)
-- 2. Preventing accidental anon key exposure
-- 3. Silencing Supabase warnings

-- Enable RLS on all tables
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_signup_intros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access (bypasses RLS anyway, but explicit is good)
-- Policy: Deny all anon access since we only use server-side API routes

-- event_types: Read-only for all (reference data)
CREATE POLICY "event_types_read_all" ON public.event_types
  FOR SELECT USING (true);

-- books: Read-only for all
CREATE POLICY "books_read_all" ON public.books
  FOR SELECT USING (true);

-- events: Read-only for all
CREATE POLICY "events_read_all" ON public.events
  FOR SELECT USING (true);

-- registrations: No public access (all operations through API)
CREATE POLICY "registrations_no_public_access" ON public.registrations
  FOR ALL USING (false);

-- settings: No public access (admin only through API)
CREATE POLICY "settings_no_public_access" ON public.settings
  FOR ALL USING (false);

-- ============================================================================
-- TABLE: settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settings_updated ON public.settings(updated_at DESC);

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create admin-assets bucket for uploaded book covers and event posters
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-assets',
  'admin-assets',
  true,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create public read policy (allows anyone to view uploaded images)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Public Access for admin-assets'
  ) THEN
    CREATE POLICY "Public Access for admin-assets"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'admin-assets');
  END IF;
END $$;

-- Create service role write policy (allows server-side uploads via service role key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Service role can upload to admin-assets'
  ) THEN
    CREATE POLICY "Service role can upload to admin-assets"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'admin-assets');
  END IF;
END $$;

-- Create service role update policy (allows server-side updates via service role key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Service role can update admin-assets'
  ) THEN
    CREATE POLICY "Service role can update admin-assets"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'admin-assets')
    WITH CHECK (bucket_id = 'admin-assets');
  END IF;
END $$;

-- Create service role delete policy (allows server-side deletions via service role key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Service role can delete from admin-assets'
  ) THEN
    CREATE POLICY "Service role can delete from admin-assets"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'admin-assets');
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads. admin-assets bucket stores book covers and event posters.';

-- ============================================================================
-- RELOAD SCHEMA CACHE
-- ============================================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- END OF INITIALIZATION SCRIPT
-- ============================================================================
