-- Migration: Create daily_costs and wpa_projects tables
-- Date: 2026-03-02
-- Rollback: ALTER TABLE public.wpa_tasks DROP CONSTRAINT IF EXISTS wpa_tasks_project_id_fkey; DROP TABLE IF EXISTS public.wpa_projects; DROP TABLE IF EXISTS public.daily_costs;

CREATE TABLE public.daily_costs (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  openai_tokens BIGINT DEFAULT 0,
  openai_cost NUMERIC(10,4) DEFAULT 0,
  anthropic_tokens BIGINT DEFAULT 0,
  anthropic_cost NUMERIC(10,4) DEFAULT 0,
  moonshot_tokens BIGINT DEFAULT 0,
  moonshot_cost NUMERIC(10,4) DEFAULT 0,
  total_cost NUMERIC(10,4) DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.wpa_projects (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'on_hold', 'completed')),
  progress_pct INTEGER DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  next_milestone TEXT DEFAULT '',
  client_id BIGINT REFERENCES public.wpa_clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wpa_tasks
  ADD CONSTRAINT wpa_tasks_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.wpa_projects(id) ON DELETE SET NULL;

ALTER TABLE public.daily_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wpa_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_full_access" ON public.daily_costs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "anon_full_access" ON public.wpa_projects
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.daily_costs TO anon, authenticated;
GRANT ALL ON public.wpa_projects TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.daily_costs_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.wpa_projects_id_seq TO anon, authenticated;
