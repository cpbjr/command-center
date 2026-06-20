-- Migration: lead generator gate — change default contact_status from NEW to IDENTIFIED
-- Rollback: ALTER TABLE wpa.wpa_businesses ALTER COLUMN contact_status SET DEFAULT 'NEW';
--           UPDATE wpa.wpa_businesses SET contact_status = 'NEW' WHERE contact_status = 'IDENTIFIED';

-- New discoveries from Bud start in IDENTIFIED (unreviewed), not NEW (active pipeline).
-- Christopher explicitly promotes IDENTIFIED → NEW to enter the lead pipeline.
ALTER TABLE wpa.wpa_businesses
  ALTER COLUMN contact_status SET DEFAULT 'IDENTIFIED';

-- Backfill: 831 NEW businesses are unreviewed Bud discoveries, not manually promoted leads.
UPDATE wpa.wpa_businesses
SET contact_status = 'IDENTIFIED'
WHERE contact_status = 'NEW';
