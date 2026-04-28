-- Migration 013: Add online_possible column to event_types
-- This allows controlling which event types can be held online

-- Add the column with default FALSE
ALTER TABLE event_types
  ADD COLUMN online_possible BOOLEAN DEFAULT FALSE;

-- Only ENGLISH_BOOK_CLUB supports online events
UPDATE event_types
  SET online_possible = TRUE
  WHERE code = 'ENGLISH_BOOK_CLUB';

-- Make column NOT NULL after setting defaults
ALTER TABLE event_types
  ALTER COLUMN online_possible SET NOT NULL;

-- Add comment
COMMENT ON COLUMN event_types.online_possible IS 'Whether this event type can be held online';
