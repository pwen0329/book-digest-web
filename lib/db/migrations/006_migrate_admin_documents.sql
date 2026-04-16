-- Migration 006: Migrate data from admin_documents to relational tables
-- This script assumes admin_documents table exists with keys: 'books', 'events', 'capacity', 'registration-success-email'

-- Step 1: Migrate books from admin_documents
-- Only run if admin_documents exists and contains books
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_documents') THEN
    -- Migrate books
    INSERT INTO books (
      slug, title, author, read_date,
      title_en, author_en, summary, summary_en,
      reading_notes, reading_notes_en,
      discussion_points, discussion_points_en,
      tags, cover_url, cover_url_en,
      cover_blur_data_url, cover_blur_data_url_en,
      links, additional_covers, sort_order
    )
    SELECT
      b->>'slug',
      b->>'title',
      b->>'author',
      (b->>'readDate')::date,
      b->>'titleEn',
      b->>'authorEn',
      b->>'summary',
      b->>'summaryEn',
      b->>'readingNotes',
      b->>'readingNotesEn',
      CASE WHEN b->'discussionPoints' IS NOT NULL
           THEN ARRAY(SELECT jsonb_array_elements_text(b->'discussionPoints'))
           ELSE NULL END,
      CASE WHEN b->'discussionPointsEn' IS NOT NULL
           THEN ARRAY(SELECT jsonb_array_elements_text(b->'discussionPointsEn'))
           ELSE NULL END,
      CASE WHEN b->'tags' IS NOT NULL
           THEN ARRAY(SELECT jsonb_array_elements_text(b->'tags'))
           ELSE NULL END,
      b->>'coverUrl',
      b->>'coverUrlEn',
      b->>'coverBlurDataURL',
      b->>'coverBlurDataURLEn',
      b->'links',
      jsonb_build_object(
        'zh', b->'coverUrls',
        'en', b->'coverUrlsEn'
      ),
      (b->>'sortOrder')::integer
    FROM (
      SELECT jsonb_array_elements(value) as b
      FROM admin_documents
      WHERE key = 'books'
    ) books_data
    ON CONFLICT (slug) DO NOTHING;

    RAISE NOTICE 'Books migrated from admin_documents';
  END IF;
END $$;

-- Step 2: Migrate capacity settings
-- This is informational - actual capacity now comes from venues table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_documents') THEN
    INSERT INTO settings (key, value, description)
    SELECT
      'legacy_capacity_' || (loc.kv).key,
      to_jsonb((loc.kv).value),
      'Legacy capacity setting for ' || (loc.kv).key || ' (now managed via venues table)'
    FROM (
      SELECT jsonb_each(value) as kv
      FROM admin_documents
      WHERE key = 'capacity'
    ) loc
    ON CONFLICT (key) DO NOTHING;

    RAISE NOTICE 'Legacy capacity settings archived';
  END IF;
END $$;

-- Step 3: Migrate email enabled setting
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_documents') THEN
    INSERT INTO settings (key, value, description)
    SELECT
      'registration_email_enabled',
      value->'enabled',
      'Send automated confirmation emails'
    FROM admin_documents
    WHERE key = 'registration-success-email'
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

    RAISE NOTICE 'Email settings migrated';
  END IF;
END $$;

-- Step 4: Events migration
-- NOTE: This requires manual intervention because we need to map events to venues
-- Template for manual event migration:
-- INSERT INTO events (slug, event_type, venue_id, title, title_en, description, description_en, event_date, cover_url, cover_url_en)
-- VALUES
--   ('TW-2025-03-example', 'TW', 1, '活動標題', 'Event Title', '描述', 'Description', '2025-03-15 14:00:00+08'::timestamptz, '/images/events/tw.jpg', NULL);

RAISE NOTICE 'Migration 006 completed. MANUAL STEP REQUIRED: Map events from admin_documents to events table with appropriate venue_id.';

-- Step 5: Link existing registrations to events
-- This will be done after events are created, based on location and date matching
-- Example (run after events are populated):
-- UPDATE registrations r
-- SET event_id = e.id
-- FROM events e
-- WHERE r.location = e.event_type
--   AND r.created_at >= e.event_date - INTERVAL '30 days'
--   AND r.created_at <= e.event_date + INTERVAL '7 days'
--   AND r.event_id IS NULL;
