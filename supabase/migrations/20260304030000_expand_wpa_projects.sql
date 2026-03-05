-- Migration: Expand wpa_projects with dates, budget, priority, agent fields + project activity log
-- Date: 2026-03-04
-- Rollback: DROP TABLE IF EXISTS public.wpa_project_updates; ALTER TABLE public.wpa_projects DROP COLUMN IF EXISTS due_date, DROP COLUMN IF EXISTS start_date, DROP COLUMN IF EXISTS budget_cents, DROP COLUMN IF EXISTS budget_spent_cents, DROP COLUMN IF EXISTS priority, DROP COLUMN IF EXISTS category, DROP COLUMN IF EXISTS owner, DROP COLUMN IF EXISTS tags, DROP COLUMN IF EXISTS metadata, DROP COLUMN IF EXISTS agent_status, DROP COLUMN IF EXISTS agent_notes, DROP COLUMN IF EXISTS last_agent_activity;

-- ===== Expand wpa_projects =====

ALTER TABLE public.wpa_projects
  ADD COLUMN due_date DATE,
  ADD COLUMN start_date DATE,
  ADD COLUMN budget_cents INTEGER DEFAULT 0,
  ADD COLUMN budget_spent_cents INTEGER DEFAULT 0,
  ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  ADD COLUMN category TEXT NOT NULL DEFAULT 'Client Work'
    CHECK (category IN ('Client Work', 'WPA Own', 'Infrastructure', 'Marketing')),
  ADD COLUMN owner TEXT NOT NULL DEFAULT 'Christopher',
  ADD COLUMN tags TEXT[] DEFAULT '{}',
  ADD COLUMN metadata JSONB DEFAULT '{}',
  ADD COLUMN agent_status TEXT NOT NULL DEFAULT 'idle'
    CHECK (agent_status IN ('idle', 'working', 'waiting_review', 'error', 'completed')),
  ADD COLUMN agent_notes TEXT DEFAULT '',
  ADD COLUMN last_agent_activity TIMESTAMPTZ;

-- Index for filtering by priority, status, category
CREATE INDEX idx_wpa_projects_priority ON public.wpa_projects(priority);
CREATE INDEX idx_wpa_projects_category ON public.wpa_projects(category);
CREATE INDEX idx_wpa_projects_due_date ON public.wpa_projects(due_date);
CREATE INDEX idx_wpa_projects_agent_status ON public.wpa_projects(agent_status);

-- ===== Project activity log =====

CREATE TABLE public.wpa_project_updates (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES public.wpa_projects(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT 'system',
  type TEXT NOT NULL CHECK (type IN (
    'status_change', 'note', 'milestone', 'budget_update',
    'task_completed', 'agent_update', 'progress_update'
  )),
  summary TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_updates_project ON public.wpa_project_updates(project_id, created_at DESC);

ALTER TABLE public.wpa_project_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_full_access" ON public.wpa_project_updates
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.wpa_project_updates TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.wpa_project_updates_id_seq TO anon, authenticated;
