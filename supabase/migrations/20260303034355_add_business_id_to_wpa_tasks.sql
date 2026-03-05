-- Migration: Add business_id FK to wpa_tasks for lead-linked tasks
-- Date: 2026-03-03
-- Rollback: ALTER TABLE public.wpa_tasks DROP COLUMN business_id;

ALTER TABLE public.wpa_tasks
  ADD COLUMN IF NOT EXISTS business_id TEXT REFERENCES public.businesses(id) ON DELETE SET NULL;
