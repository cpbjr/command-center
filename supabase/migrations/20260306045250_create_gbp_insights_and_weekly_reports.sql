-- Migration: create wpa_gbp_insights and wpa_weekly_reports
-- Date: 2026-03-06
-- Rollback: DROP TABLE wpa.wpa_gbp_insights CASCADE; DROP TABLE wpa.wpa_weekly_reports CASCADE;

-- Weekly GBP Insights tracking (manual input from dashboard)
CREATE TABLE wpa.wpa_gbp_insights (
  id                  BIGSERIAL PRIMARY KEY,
  client_id           BIGINT NOT NULL REFERENCES wpa.wpa_clients(id) ON DELETE CASCADE,
  week_ending         DATE NOT NULL,
  search_views        INTEGER,
  maps_views          INTEGER,
  profile_views       INTEGER,
  website_clicks      INTEGER,
  phone_calls         INTEGER,
  direction_requests  INTEGER,
  photo_views         INTEGER,
  message_count       INTEGER,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_gbp_insights_client_week
  ON wpa.wpa_gbp_insights(client_id, week_ending);

CREATE INDEX idx_gbp_insights_week
  ON wpa.wpa_gbp_insights(week_ending DESC);

ALTER TABLE wpa.wpa_gbp_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access" ON wpa.wpa_gbp_insights
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON wpa.wpa_gbp_insights TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE wpa.wpa_gbp_insights_id_seq
  TO anon, authenticated, service_role;

-- Sent weekly report archive
CREATE TABLE wpa.wpa_weekly_reports (
  id              BIGSERIAL PRIMARY KEY,
  client_id       BIGINT NOT NULL REFERENCES wpa.wpa_clients(id) ON DELETE CASCADE,
  week_ending     DATE NOT NULL,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  client_email    TEXT,
  drafted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'sent', 'skipped')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_weekly_reports_client_week
  ON wpa.wpa_weekly_reports(client_id, week_ending);

CREATE INDEX idx_weekly_reports_status
  ON wpa.wpa_weekly_reports(status);

ALTER TABLE wpa.wpa_weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access" ON wpa.wpa_weekly_reports
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON wpa.wpa_weekly_reports TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE wpa.wpa_weekly_reports_id_seq
  TO anon, authenticated, service_role;
