-- Migration 006: Create event_types reference table
-- This table stores event type information with bilingual names

-- Create event_types table
CREATE TABLE IF NOT EXISTS event_types (
  code VARCHAR(50) PRIMARY KEY,  -- e.g., 'BOOK_CLUB', 'DETOX', 'FAMILY_READING_CLUB'
  name_en VARCHAR(100) NOT NULL, -- English name
  name_zh VARCHAR(100) NOT NULL  -- Mandarin/Chinese name
);

-- Insert default event types
INSERT INTO event_types (code, name_en, name_zh) VALUES
  ('BOOK_CLUB', 'Book Club', '讀書會'),
  ('DETOX', 'Detox', '排毒'),
  ('FAMILY_READING_CLUB', 'Family Reading Club', '親子讀書會')
ON CONFLICT (code) DO NOTHING;

-- Add comment
COMMENT ON TABLE event_types IS 'Reference table for event types with bilingual names';
