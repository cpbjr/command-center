-- Migration: Ensure IDENTIFIED is in businesses contact_status CHECK constraint
-- Date: 2026-03-04
-- Rollback: DROP CONSTRAINT IF EXISTS businesses_contact_status_check;
--           ADD CONSTRAINT businesses_contact_status_check
--             CHECK (contact_status IN ('NEW', 'CONTACTED', 'REPLIED', 'CLOSED', 'CLOSED-WON'));

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_contact_status_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_contact_status_check
  CHECK (contact_status IN ('NEW', 'IDENTIFIED', 'CONTACTED', 'REPLIED', 'CLOSED', 'CLOSED-WON'));
