-- Migration: Drop OC Bob compatibility shim (no longer needed)
-- Date: 2026-03-05
-- Prerequisite: OC Bob updated to send Accept-Profile: wpa header
-- Rollback: CREATE VIEW public.wpa_tasks AS SELECT * FROM wpa.wpa_tasks;
--           GRANT SELECT, UPDATE ON public.wpa_tasks TO anon, authenticated;

DROP VIEW IF EXISTS public.wpa_tasks;
