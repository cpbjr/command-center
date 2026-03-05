-- Migration: Add recurring task support to wpa_tasks
-- Date: 2026-03-04
-- Rollback: ALTER TABLE wpa_tasks DROP COLUMN is_template, DROP COLUMN recurrence_rule, DROP COLUMN last_generated_at;

ALTER TABLE public.wpa_tasks
  ADD COLUMN is_template       BOOLEAN DEFAULT false,
  ADD COLUMN recurrence_rule   TEXT,
  ADD COLUMN last_generated_at DATE;
