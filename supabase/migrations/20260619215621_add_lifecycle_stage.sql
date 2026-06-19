-- Migration: add lifecycle_stage to wpa_businesses
-- Rollback: ALTER TABLE wpa.wpa_businesses DROP COLUMN lifecycle_stage; DROP TYPE wpa.lifecycle_stage;

CREATE TYPE wpa.lifecycle_stage AS ENUM ('lead', 'client', 'churned');

ALTER TABLE wpa.wpa_businesses
  ADD COLUMN lifecycle_stage wpa.lifecycle_stage NOT NULL DEFAULT 'lead';

-- Backfill: any business with a wpa_clients row is already a client
UPDATE wpa.wpa_businesses b
SET lifecycle_stage = 'client'
WHERE EXISTS (
  SELECT 1 FROM wpa.wpa_clients c WHERE c.business_id = b.id
);
