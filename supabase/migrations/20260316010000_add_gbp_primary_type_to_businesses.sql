-- Migration: Add schema-audit columns to wpa_businesses
-- Adds gbp_primary_type, lead_source, closed_date, contract_value

ALTER TABLE wpa.wpa_businesses
  ADD COLUMN IF NOT EXISTS gbp_primary_type TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lead_source TEXT,
  ADD COLUMN IF NOT EXISTS closed_date TEXT,
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC(10,2);
