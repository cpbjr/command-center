-- Migration: Add 'IDENTIFIED' to businesses contact_status CHECK constraint
-- Date: 2026-03-03
-- Rollback: Drop and re-add constraint without IDENTIFIED

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_contact_status_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_contact_status_check
  CHECK (contact_status IN ('NEW', 'IDENTIFIED', 'CONTACTED', 'REPLIED', 'CLOSED', 'CLOSED-WON'));
