-- Migration: Add 'Quick Win' service tier + client activity log table
-- Date: 2026-03-03
-- Rollback: ALTER TABLE public.wpa_clients DROP CONSTRAINT wpa_clients_service_tier_check,
--   ADD CONSTRAINT wpa_clients_service_tier_check CHECK (service_tier IN ('Lazy Ranking', 'Core 30', 'Geographic Expansion'));
--   DROP TABLE IF EXISTS public.wpa_client_activity;

-- 1. Drop and recreate CHECK constraint to add Quick Win
ALTER TABLE public.wpa_clients
  DROP CONSTRAINT IF EXISTS wpa_clients_service_tier_check;

ALTER TABLE public.wpa_clients
  ADD CONSTRAINT wpa_clients_service_tier_check
  CHECK (service_tier IN ('Lazy Ranking', 'Core 30', 'Geographic Expansion', 'Quick Win'));

-- 2. Create client activity log table
CREATE TABLE public.wpa_client_activity (
  id         BIGSERIAL PRIMARY KEY,
  client_id  BIGINT NOT NULL REFERENCES public.wpa_clients(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'text', 'action', 'note')),
  summary    TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX wpa_client_activity_client_id_idx ON public.wpa_client_activity(client_id);
CREATE INDEX wpa_client_activity_occurred_at_idx ON public.wpa_client_activity(occurred_at DESC);

ALTER TABLE public.wpa_client_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access" ON public.wpa_client_activity FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.wpa_client_activity TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.wpa_client_activity_id_seq TO anon, authenticated;
