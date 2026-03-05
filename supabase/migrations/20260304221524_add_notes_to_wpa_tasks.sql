-- Migration: Add notes column to wpa_tasks
-- Date: 2026-03-04
-- Rollback: ALTER TABLE public.wpa_tasks DROP COLUMN IF EXISTS notes;

ALTER TABLE public.wpa_tasks
  ADD COLUMN IF NOT EXISTS notes TEXT;
