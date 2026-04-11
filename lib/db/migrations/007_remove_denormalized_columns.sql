-- Migration 007: Remove denormalized columns from registrations
-- Remove location (can be accessed via event_id -> venue_id -> location)
-- Remove book_id (can be accessed via event_id -> book_id)

-- Drop indexes
DROP INDEX IF EXISTS idx_registrations_location_status;
DROP INDEX IF EXISTS idx_registrations_book;

-- Drop foreign key constraint
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS fk_registrations_book;

-- Drop columns
ALTER TABLE registrations DROP COLUMN IF EXISTS location;
ALTER TABLE registrations DROP COLUMN IF EXISTS book_id;
