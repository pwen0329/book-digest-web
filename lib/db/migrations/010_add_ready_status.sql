-- Migration 010: Add 'ready' status to registrations
-- Adds the 'ready' status to represent registrations that have received final confirmation
-- Status flow: created → pending → confirmed → ready (or cancelled at any point)

-- Update the status check constraint to include 'ready'
ALTER TABLE public.registrations
DROP CONSTRAINT IF EXISTS registrations_status_check;

ALTER TABLE public.registrations
ADD CONSTRAINT registrations_status_check
CHECK (status IN ('created', 'pending', 'confirmed', 'cancelled', 'ready'));

-- Add comment explaining status flow
COMMENT ON COLUMN public.registrations.status IS
'Registration status flow: created → pending → confirmed → ready (or cancelled at any point). ready = final confirmation email sent';
