-- Migration 004: Update registrations table
-- Add event_id and book_id foreign keys

-- Add new columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='registrations' AND column_name='event_id') THEN
    ALTER TABLE registrations ADD COLUMN event_id BIGINT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='registrations' AND column_name='book_id') THEN
    ALTER TABLE registrations ADD COLUMN book_id BIGINT;
  END IF;
END $$;

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name='fk_registrations_event') THEN
    ALTER TABLE registrations
      ADD CONSTRAINT fk_registrations_event
      FOREIGN KEY (event_id)
      REFERENCES events(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name='fk_registrations_book') THEN
    ALTER TABLE registrations
      ADD CONSTRAINT fk_registrations_book
      FOREIGN KEY (book_id)
      REFERENCES books(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_book ON registrations(book_id);

-- Note: event_id will be populated in migration 006 after events are migrated
