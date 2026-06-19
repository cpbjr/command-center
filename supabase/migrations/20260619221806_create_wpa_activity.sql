-- Migration: unified activity log on business_id
-- Date: 2026-06-19
-- Rollback: DROP TABLE wpa.wpa_activity;

CREATE TABLE wpa.wpa_activity (
  id          SERIAL PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES wpa.wpa_businesses(id),
  type        TEXT NOT NULL CHECK (type IN ('call','email','meeting','text','action','note','stage_change')),
  summary     TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate from wpa_business_activity
INSERT INTO wpa.wpa_activity (business_id, type, summary, occurred_at, created_at)
SELECT business_id, type, summary, occurred_at, created_at
FROM wpa.wpa_business_activity;

-- Migrate from wpa_client_activity (join through wpa_clients to get business_id)
INSERT INTO wpa.wpa_activity (business_id, type, summary, occurred_at, created_at)
SELECT cl.business_id, ca.type, ca.summary, ca.occurred_at, ca.created_at
FROM wpa.wpa_client_activity ca
JOIN wpa.wpa_clients cl ON ca.client_id = cl.id
WHERE cl.business_id IS NOT NULL;

GRANT SELECT, INSERT ON wpa.wpa_activity TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE wpa.wpa_activity_id_seq TO anon, authenticated;
