-- Migration 001: Create venues table
-- Venues represent physical or virtual locations where events are held

CREATE TABLE IF NOT EXISTS venues (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  location VARCHAR(20) NOT NULL,
  address TEXT,
  max_capacity INTEGER NOT NULL CHECK (max_capacity > 0),
  is_virtual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_venues_name ON venues(name);
CREATE INDEX IF NOT EXISTS idx_venues_location ON venues(location);
CREATE INDEX IF NOT EXISTS idx_venues_is_virtual ON venues(is_virtual);

-- Initial seed data
INSERT INTO venues (name, location, address, max_capacity, is_virtual) VALUES
  ('Louisa Cafe Taipei Main Station', 'TW', '2F, No. 3, Section 1, Zhongxiao W Rd, Zhongzheng District, Taipei City, 100', 30, false),
  ('Louisa Cafe Taipei Xinyi', 'TW', '1F, No. 11, Section 5, Xinyi Rd, Xinyi District, Taipei City, 110', 25, false),
  ('Starbucks Amsterdam Centraal', 'NL', 'Platform 2B, Stationsplein, 1012 AB Amsterdam, Netherlands', 25, false),
  ('Zoom Meeting Room - Book Digest', 'ONLINE', 'https://zoom.us/j/bookdigest', 100, true)
ON CONFLICT (name) DO NOTHING;
