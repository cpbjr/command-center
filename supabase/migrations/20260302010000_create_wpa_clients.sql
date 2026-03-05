-- Migration: Create wpa_clients table
-- Date: 2026-03-02
-- Rollback: DROP TABLE IF EXISTS public.wpa_clients;

CREATE TABLE public.wpa_clients (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  service_tier TEXT NOT NULL DEFAULT 'Lazy Ranking'
    CHECK (service_tier IN ('Lazy Ranking', 'Core 30', 'Geographic Expansion')),
  monthly_revenue NUMERIC(10,2) DEFAULT 0,
  current_phase TEXT DEFAULT '',
  next_action TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'churned')),
  start_date DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wpa_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_full_access" ON public.wpa_clients
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.wpa_clients TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.wpa_clients_id_seq TO anon, authenticated;
