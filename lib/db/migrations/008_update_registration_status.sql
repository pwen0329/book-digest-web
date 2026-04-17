-- Migration 008: Update registration status constraint and remove source column
-- 1. Add 'created' status (used when registration is first submitted)
-- 2. Remove 'source' column (deprecated after removing Notion/Tally integration)

-- Drop old constraint and add new one with 'created' status
DO $$
BEGIN
  -- Drop existing status constraint if it exists
  IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage
             WHERE table_name='registrations' AND constraint_name='registrations_status_check') THEN
    ALTER TABLE registrations DROP CONSTRAINT registrations_status_check;
  END IF;

  -- Add new constraint with 'created' status
  ALTER TABLE registrations ADD CONSTRAINT registrations_status_check
    CHECK (status IN ('created', 'pending', 'confirmed', 'cancelled'));
END $$;

-- Remove source column (deprecated)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='registrations' AND column_name='source') THEN
    ALTER TABLE registrations DROP COLUMN source;
  END IF;
END $$;
