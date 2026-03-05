-- Migration: Add 'Marketing' to wpa_tasks category CHECK constraint
-- Date: 2026-03-03
-- Rollback: See below (requires dropping and re-adding constraint)

ALTER TABLE public.wpa_tasks
  DROP CONSTRAINT IF EXISTS wpa_tasks_category_check;

ALTER TABLE public.wpa_tasks
  ADD CONSTRAINT wpa_tasks_category_check
  CHECK (category IN ('Client Work', 'WPA Own', 'Infrastructure', 'Marketing', 'Backlog'));
