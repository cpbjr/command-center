-- Migration: contacts attach to business only, drop client_id
-- Date: 2026-06-19
-- Rollback: ALTER TABLE wpa.wpa_contacts ADD COLUMN client_id INT;

-- Backfill any contacts that have only client_id (safety net)
UPDATE wpa.wpa_contacts c
SET business_id = cl.business_id
FROM wpa.wpa_clients cl
WHERE c.client_id = cl.id
  AND c.business_id IS NULL
  AND cl.business_id IS NOT NULL;

ALTER TABLE wpa.wpa_contacts DROP COLUMN IF EXISTS client_id;
ALTER TABLE wpa.wpa_contacts ALTER COLUMN business_id SET NOT NULL;
