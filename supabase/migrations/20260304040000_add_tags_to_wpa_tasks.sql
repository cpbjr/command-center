-- Migration: Add tags array to wpa_tasks
-- Date: 2026-03-04
-- Rollback: ALTER TABLE public.wpa_tasks DROP COLUMN IF EXISTS tags;

ALTER TABLE public.wpa_tasks
  ADD COLUMN tags TEXT[] DEFAULT '{}';

CREATE INDEX idx_wpa_tasks_tags ON public.wpa_tasks USING GIN(tags);
