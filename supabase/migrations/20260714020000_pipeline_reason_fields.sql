-- Migration: pipeline reason fields (Phase 2 Step 5, additive)
-- Date: 2026-07-14
-- Rollback: ALTER TABLE wpa.wpa_businesses DROP COLUMN dropped_reason;
--   ALTER TABLE wpa.wpa_contracts DROP COLUMN close_reason, DROP COLUMN closed_at;

ALTER TABLE wpa.wpa_businesses
  ADD COLUMN dropped_reason TEXT
  CHECK (dropped_reason IN ('declined','not_a_fit','no_response'));

ALTER TABLE wpa.wpa_contracts
  ADD COLUMN close_reason TEXT
  CHECK (close_reason IN ('work_completed','parted_ways')),
  ADD COLUMN closed_at TIMESTAMPTZ;
