# Test Data SQL Files

SQL INSERT statements generated from JSON data files.

## Files

- `events.sql` - INSERT statements for 9 events
- `books.sql` - INSERT statements for 60 books

## Usage

### Load into database:

```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]/[DATABASE]" -f test-data/events.sql
psql "postgresql://postgres:[PASSWORD]@[HOST]/[DATABASE]" -f test-data/books.sql
```

### Or in Supabase SQL Editor:

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the content of each SQL file
3. Click "Run"

## Schema Requirements

These SQL files assume the following table structures:

```sql
CREATE TABLE events (
  id integer PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  event_type_code text NOT NULL,
  venue_id integer NOT NULL,
  title text NOT NULL,
  title_en text,
  description text,
  description_en text,
  event_date timestamptz NOT NULL,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  cover_url text,
  cover_url_en text,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE books (
  id serial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  sort_order integer,
  title text NOT NULL,
  author text NOT NULL,
  read_date date,
  title_en text,
  author_en text,
  summary text,
  summary_en text,
  reading_notes text,
  reading_notes_en text,
  discussion_points text[],
  discussion_points_en text[],
  tags text[],
  cover_url text,
  cover_url_en text,
  cover_blur_data_url text,
  cover_blur_data_url_en text,
  links jsonb,
  additional_covers jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);
```

## Notes

- All string values are properly escaped for SQL
- Arrays use PostgreSQL ARRAY syntax
- Objects (links, additionalCovers) use JSONB
- To update existing records instead of failing on duplicates, uncomment the `ON CONFLICT` clauses at the end of each file
