-- Migration: Add CLOSED-WON status to businesses contact_status
-- Date: 2026-03-03
-- Rollback: ALTER TABLE public.businesses DROP CONSTRAINT businesses_contact_status_check;
--           ALTER TABLE public.businesses ADD CONSTRAINT businesses_contact_status_check
--             CHECK (contact_status IN ('NEW', 'CONTACTED', 'REPLIED', 'CLOSED'));

-- Drop existing constraint and re-add with new values
ALTER TABLE public.businesses DROP CONSTRAINT businesses_contact_status_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_contact_status_check
  CHECK (contact_status IN ('NEW', 'CONTACTED', 'REPLIED', 'CLOSED', 'CLOSED-WON'));
