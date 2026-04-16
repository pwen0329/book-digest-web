-- Migration 005: Create settings table
-- Runtime configuration stored as key-value pairs

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settings_updated ON settings(updated_at DESC);

-- Initial settings
INSERT INTO settings (key, value, description) VALUES
  ('registration_email_enabled', 'true', 'Send automated confirmation emails to registrants'),
  ('maintenance_mode', 'false', 'Enable maintenance mode to block new registrations'),
  ('max_daily_registrations', '50', 'Maximum registrations allowed per day across all events')
ON CONFLICT (key) DO NOTHING;
