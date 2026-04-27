-- Migration 010: Merge Venues into Events
-- This migration consolidates venue management into the events table

BEGIN;

-- Step 1: Add new venue columns to events table (nullable initially for safe migration)
ALTER TABLE events
  ADD COLUMN venue_name TEXT,
  ADD COLUMN venue_name_en TEXT,
  ADD COLUMN venue_capacity INTEGER,
  ADD COLUMN venue_address TEXT,
  ADD COLUMN venue_location TEXT;

-- Step 2: Migrate existing venue data from venues table to events
UPDATE events
SET
  venue_name = venues.name,
  venue_name_en = venues.name, -- venues table doesn't have name_en, use name as fallback
  venue_capacity = venues.max_capacity,
  venue_address = venues.address,
  venue_location = venues.location
FROM venues
WHERE events.venue_id = venues.id;

-- Step 3: Make venue_location NOT NULL with CHECK constraint
-- All events must have a location (TW, NL, or ONLINE)
ALTER TABLE events
  ALTER COLUMN venue_location SET NOT NULL,
  ADD CONSTRAINT events_venue_location_check
    CHECK (venue_location IN ('TW', 'NL', 'ONLINE'));

-- Step 4: Add CHECK constraint for venue_capacity (must be positive when not null)
ALTER TABLE events
  ADD CONSTRAINT events_venue_capacity_check
    CHECK (venue_capacity IS NULL OR venue_capacity > 0);

-- Step 5: Update NULL payment values to defaults (must happen before NOT NULL constraint)
UPDATE events
SET payment_currency = 'TWD'
WHERE payment_currency IS NULL;

UPDATE events
SET payment_amount = 0
WHERE payment_amount IS NULL;

-- Step 6: Set defaults and make payment fields NOT NULL
ALTER TABLE events
  ALTER COLUMN payment_currency SET DEFAULT 'TWD',
  ALTER COLUMN payment_currency SET NOT NULL,
  ALTER COLUMN payment_amount SET DEFAULT 0,
  ALTER COLUMN payment_amount SET NOT NULL;

-- Step 7: Drop the foreign key constraint on venue_id
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_venue_id_fkey;

-- Step 8: Drop the venue_id column
ALTER TABLE events
  DROP COLUMN venue_id;

-- Step 9: Drop the venues table and its indexes
DROP TABLE IF EXISTS venues CASCADE;

-- Step 10: Create index on venue_location for efficient filtering
CREATE INDEX idx_events_venue_location ON events(venue_location);

COMMIT;
