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
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  source TEXT NOT NULL CHECK (source IN ('pending', 'simulated', 'tally', 'notion')),
  external_id TEXT,
  mirror_state JSONB NOT NULL DEFAULT '{"notion":{"enabled":false,"status":"not_configured"},"tally":{"enabled":false,"status":"not_configured"},"email":{"enabled":false,"status":"not_configured"}}'::jsonb,
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
CREATE INDEX IF NOT EXISTS idx_registrations_external_id ON public.registrations (external_id);
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

-- Row level security
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABLE: event_types (reference table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_types (
  code VARCHAR(50) PRIMARY KEY,
  name_en VARCHAR(100) NOT NULL,
  name_zh VARCHAR(100) NOT NULL
);

COMMENT ON TABLE public.event_types IS 'Reference table for event types with bilingual names';

-- ============================================================================
-- TABLE: venues
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.venues (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  location VARCHAR(20) NOT NULL,
  address TEXT,
  max_capacity INTEGER NOT NULL CHECK (max_capacity > 0),
  is_virtual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_venues_name ON public.venues(name);
CREATE INDEX IF NOT EXISTS idx_venues_location ON public.venues(location);
CREATE INDEX IF NOT EXISTS idx_venues_is_virtual ON public.venues(is_virtual);

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
-- TABLE: events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.events (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  event_type_code VARCHAR(50) NOT NULL REFERENCES public.event_types(code) ON DELETE RESTRICT,
  venue_id BIGINT NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,

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

  -- Status
  is_published BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(event_type_code);
CREATE INDEX IF NOT EXISTS idx_events_venue ON public.events(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_published ON public.events(is_published);
CREATE INDEX IF NOT EXISTS idx_events_book ON public.events(book_id);

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
-- ADD FOREIGN KEYS TO REGISTRATIONS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name='fk_registrations_event') THEN
    ALTER TABLE public.registrations
      ADD CONSTRAINT fk_registrations_event
      FOREIGN KEY (event_id)
      REFERENCES public.events(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Add indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_registrations_event ON public.registrations(event_id);

-- ============================================================================
-- RELOAD SCHEMA CACHE
-- ============================================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- END OF INITIALIZATION SCRIPT
-- ============================================================================
