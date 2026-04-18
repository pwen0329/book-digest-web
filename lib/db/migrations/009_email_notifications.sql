-- Migration 009: Email Notifications Infrastructure
-- 1. Add payment configuration to events table
-- 2. Create email audit table for tracking sent emails
-- 3. Add email reservation confirmation setting

-- Add payment columns to events table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='events' AND column_name='payment_amount') THEN
    ALTER TABLE events ADD COLUMN payment_amount DECIMAL(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='events' AND column_name='payment_currency') THEN
    ALTER TABLE events ADD COLUMN payment_currency VARCHAR(3) CHECK (payment_currency IN ('TWD', 'EUR', 'USD'));
  END IF;
END $$;

-- Create email_audit table
CREATE TABLE IF NOT EXISTS email_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recipient_email VARCHAR(254) NOT NULL,
  email_type VARCHAR(50) NOT NULL CHECK (email_type IN ('reservation_confirmation', 'payment_confirmation', 'test')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  registration_id TEXT REFERENCES registrations(id) ON DELETE SET NULL,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  locale VARCHAR(5) NOT NULL DEFAULT 'en',
  subject TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_audit_sent_at ON email_audit(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_audit_recipient ON email_audit(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_audit_registration ON email_audit(registration_id);

-- Add reservation confirmation email setting to settings table
INSERT INTO settings (key, value, description, updated_at)
VALUES (
  'email.reservation_confirmation_enabled',
  'false',
  'Enable automatic reservation confirmation emails sent to users immediately after registration',
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Add comments
COMMENT ON TABLE email_audit IS 'Audit trail for all emails sent by the system';
COMMENT ON COLUMN events.payment_amount IS 'Payment amount required for event registration';
COMMENT ON COLUMN events.payment_currency IS 'Currency code for payment amount (TWD, EUR, USD)';
