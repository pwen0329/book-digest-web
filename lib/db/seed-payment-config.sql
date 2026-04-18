-- Seed payment configuration for existing events
-- This is for development/testing purposes

-- Update Taiwan events with TWD pricing
UPDATE events
SET payment_amount = 200.00, payment_currency = 'TWD'
WHERE venue_id IN (SELECT id FROM venues WHERE location = 'TW')
  AND payment_amount IS NULL;

-- Update Netherlands events with EUR pricing
UPDATE events
SET payment_amount = 10.00, payment_currency = 'EUR'
WHERE venue_id IN (SELECT id FROM venues WHERE location = 'NL')
  AND payment_amount IS NULL;

-- Display updated events
SELECT
  e.id,
  e.title,
  e.payment_amount,
  e.payment_currency,
  v.location
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE e.payment_amount IS NOT NULL
ORDER BY e.id;
