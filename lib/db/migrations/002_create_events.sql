-- Migration 002: Create events table
-- Events are scheduled reading club sessions linked to venues and optionally books
-- All timestamps stored in UTC

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  event_type_code VARCHAR(50) NOT NULL REFERENCES event_types(code) ON DELETE RESTRICT,
  venue_id BIGINT NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,

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
  book_id BIGINT,  -- FK constraint added after books table created

  -- Cover images
  cover_url TEXT,
  cover_url_en TEXT,

  -- Status
  is_published BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type_code);
CREATE INDEX IF NOT EXISTS idx_events_venue ON events(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_published ON events(is_published);
