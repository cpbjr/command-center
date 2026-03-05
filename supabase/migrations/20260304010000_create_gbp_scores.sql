-- Migration: Create wpa_gbp_scores for time-series GBP score tracking
-- Date: 2026-03-04
-- Rollback: DROP TABLE IF EXISTS public.wpa_gbp_scores;

CREATE TABLE public.wpa_gbp_scores (
  id          BIGSERIAL PRIMARY KEY,
  client_id   BIGINT NOT NULL REFERENCES public.wpa_clients(id) ON DELETE CASCADE,
  score       NUMERIC(3,1) CHECK (score >= 0 AND score <= 10),
  notes       TEXT,
  recorded_at DATE DEFAULT current_date,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON public.wpa_gbp_scores (client_id, recorded_at DESC);

ALTER TABLE public.wpa_gbp_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access" ON public.wpa_gbp_scores FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.wpa_gbp_scores TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.wpa_gbp_scores_id_seq TO anon, authenticated;
