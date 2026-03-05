-- Migration: Correct Harveys project record to match actual Phase 1 state
-- Date: 2026-03-03
-- Rollback: UPDATE wpa_projects SET name = 'Harveys Website Build', ... WHERE ...

UPDATE public.wpa_projects SET
  name           = 'Harvey''s at BanBury — Phase 1 Quick Win',
  description    = 'GBP optimization + Restaurant schema markup. Free portfolio build. Phase 2 (paid) pending results.',
  status         = 'active',
  progress_pct   = 40,
  next_milestone = 'Schema markup on banburygolf.com (blocked on Lightspeed)'
WHERE name = 'Harveys Website Build';
