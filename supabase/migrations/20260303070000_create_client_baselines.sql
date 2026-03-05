-- Migration: Create wpa_client_baselines for GBP/GTrack metric snapshots
-- Date: 2026-03-03
-- Rollback: DROP TABLE IF EXISTS public.wpa_client_baselines;

CREATE TABLE public.wpa_client_baselines (
  id                       BIGSERIAL PRIMARY KEY,
  client_id                BIGINT NOT NULL REFERENCES public.wpa_clients(id) ON DELETE CASCADE,
  snapshot_date            DATE NOT NULL,
  keyword                  TEXT,
  -- GTrack grid metrics
  gtrack_avg_position      NUMERIC(5,1),
  gtrack_best_position     INTEGER,
  gtrack_grid_size         INTEGER,
  gtrack_top3_count        INTEGER,
  gtrack_top10_count       INTEGER,
  gtrack_20plus_count      INTEGER,
  -- Discovery ranking
  discovery_rank           INTEGER,
  discovery_total          INTEGER,
  discovery_query          TEXT,
  -- GBP basic metrics
  gbp_rating               NUMERIC(3,2),
  gbp_review_count         INTEGER,
  -- Audit-derived fields
  mobile_lcp_seconds       NUMERIC(5,1),
  mobile_speed_score       INTEGER,
  has_schema               BOOLEAN,
  -- Notes
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX wpa_client_baselines_client_id_idx ON public.wpa_client_baselines(client_id);

ALTER TABLE public.wpa_client_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access" ON public.wpa_client_baselines FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.wpa_client_baselines TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.wpa_client_baselines_id_seq TO anon, authenticated;
