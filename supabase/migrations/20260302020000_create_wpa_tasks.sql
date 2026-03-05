-- Migration: Create wpa_tasks table
-- Date: 2026-03-02
-- Rollback: DROP TABLE IF EXISTS public.wpa_tasks;

CREATE TABLE public.wpa_tasks (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'WPA Own'
    CHECK (category IN ('Client Work', 'WPA Own', 'Infrastructure', 'Backlog')),
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  client_id BIGINT REFERENCES public.wpa_clients(id) ON DELETE SET NULL,
  project_id BIGINT,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wpa_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_full_access" ON public.wpa_tasks
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.wpa_tasks TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.wpa_tasks_id_seq TO anon, authenticated;
