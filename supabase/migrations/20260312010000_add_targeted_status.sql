-- Migration: Add 'TARGETED' to businesses contact_status CHECK constraint
-- Date: 2026-03-12
-- Rollback: Drop constraint and re-add without TARGETED

ALTER TABLE wpa.wpa_businesses
  DROP CONSTRAINT IF EXISTS businesses_contact_status_check;

ALTER TABLE wpa.wpa_businesses
  ADD CONSTRAINT businesses_contact_status_check
  CHECK (contact_status IN ('NEW', 'IDENTIFIED', 'TARGETED', 'CONTACTED', 'REPLIED', 'CLOSED', 'CLOSED-WON'));
