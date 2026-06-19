-- Migration: create wpa_contracts, migrate from wpa_clients
-- Rollback: DROP TABLE wpa.wpa_contracts;

CREATE TABLE wpa.wpa_contracts (
  id              SERIAL PRIMARY KEY,
  business_id     TEXT NOT NULL REFERENCES wpa.wpa_businesses(id),
  service_tier    TEXT NOT NULL,
  monthly_revenue NUMERIC(10,2) NOT NULL DEFAULT 0,
  current_phase   TEXT NOT NULL DEFAULT '',
  next_action     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'churned')),
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date        DATE,
  notes           TEXT NOT NULL DEFAULT '',
  folder_path     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate existing wpa_clients rows (all 3 now have business_id set)
INSERT INTO wpa.wpa_contracts
  (business_id, service_tier, monthly_revenue, current_phase, next_action,
   status, start_date, notes, folder_path, created_at)
SELECT
  business_id,
  service_tier,
  monthly_revenue,
  COALESCE(current_phase, ''),
  COALESCE(next_action, ''),
  status,
  COALESCE(start_date, CURRENT_DATE)::DATE,
  COALESCE(notes, ''),
  folder_path,
  created_at
FROM wpa.wpa_clients
WHERE business_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON wpa.wpa_contracts TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE wpa.wpa_contracts_id_seq TO anon, authenticated;
