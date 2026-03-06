-- Migration: Move winnow tables from public to wpa schema + rename to wpa_ prefix
-- Date: 2026-03-06
-- Rollback: ALTER TABLE wpa.wpa_winnow_decisions SET SCHEMA public;
--           ALTER TABLE public.wpa_winnow_decisions RENAME TO winnow_decisions;
--           ALTER TABLE wpa.wpa_winnow_runs SET SCHEMA public;
--           ALTER TABLE public.wpa_winnow_runs RENAME TO winnow_runs;

ALTER TABLE public.winnow_decisions SET SCHEMA wpa;
ALTER TABLE wpa.winnow_decisions RENAME TO wpa_winnow_decisions;

ALTER TABLE public.winnow_runs SET SCHEMA wpa;
ALTER TABLE wpa.winnow_runs RENAME TO wpa_winnow_runs;

GRANT ALL ON wpa.wpa_winnow_decisions TO anon, authenticated;
GRANT ALL ON wpa.wpa_winnow_runs TO anon, authenticated;
