-- Migration 003: Create books table
-- Books use relational columns with some JSONB for nested data

CREATE TABLE IF NOT EXISTS books (
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

  -- Content (can be long)
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

  -- JSONB for flexible nested data
  links JSONB,  -- {publisher: "url", notes: "url"}
  additional_covers JSONB,  -- {zh: ["url1", "url2"], en: ["url3"]}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_books_slug ON books(slug);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_read_date ON books(read_date DESC);
CREATE INDEX IF NOT EXISTS idx_books_tags ON books USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_books_sort_order ON books(sort_order);

-- Now add FK constraint from events to books
ALTER TABLE events
  ADD CONSTRAINT fk_events_book
  FOREIGN KEY (book_id)
  REFERENCES books(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_book ON events(book_id);
