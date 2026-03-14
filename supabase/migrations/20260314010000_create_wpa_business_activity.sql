-- Migration: create wpa_business_activity
-- Date: 2026-03-14
-- Rollback: DROP TABLE wpa.wpa_business_activity;
-- References: wpa.wpa_businesses(id)

CREATE TABLE wpa.wpa_business_activity (
  id           BIGSERIAL PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES wpa.wpa_businesses(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'text', 'action', 'note')),
  summary      TEXT NOT NULL,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX wpa_business_activity_business_id_idx ON wpa.wpa_business_activity(business_id);
CREATE INDEX wpa_business_activity_occurred_at_idx  ON wpa.wpa_business_activity(occurred_at DESC);

ALTER TABLE wpa.wpa_business_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access" ON wpa.wpa_business_activity FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON wpa.wpa_business_activity TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE wpa.wpa_business_activity_id_seq TO anon, authenticated;
