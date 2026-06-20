-- Migration: Enable RLS on tables created without it
-- Date: 2026-05-15
-- Applied: via Supabase SQL editor (db push blocked by TurfSheet migration history mismatch)
-- Rollback: ALTER TABLE wpa.gbp_analytics DISABLE ROW LEVEL SECURITY;
--           ALTER TABLE wpa.wpa_service_ranks DISABLE ROW LEVEL SECURITY;
--           ALTER TABLE public.jobs DISABLE ROW LEVEL SECURITY;
--           ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;

-- gbp_analytics (created 2026-03-08, missing RLS)
ALTER TABLE wpa.gbp_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access" ON wpa.gbp_analytics
  FOR ALL USING (true) WITH CHECK (true);

-- wpa_service_ranks (created 2026-03-16, missing RLS)
ALTER TABLE wpa.wpa_service_ranks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access" ON wpa.wpa_service_ranks
  FOR ALL USING (true) WITH CHECK (true);

-- Legacy public schema TurfSheet tables (discovered during audit)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access" ON public.jobs
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access" ON public.staff
  FOR ALL USING (true) WITH CHECK (true);
