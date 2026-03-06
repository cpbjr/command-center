-- Migration: Add business_id to wpa_clients
-- Links clients back to their original business/lead record
-- Rollback: ALTER TABLE wpa.wpa_clients DROP COLUMN business_id;

ALTER TABLE wpa.wpa_clients
  ADD COLUMN business_id TEXT REFERENCES wpa.wpa_businesses(id) ON DELETE SET NULL;

CREATE INDEX idx_wpa_clients_business_id ON wpa.wpa_clients(business_id);
