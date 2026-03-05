-- Migration: Remove duplicate Dog Zen client (id=1, no contact info)
-- Date: 2026-03-03
-- Context: id=3 'A Dog Zen Salon' is the correct record with full address/phone/website.
--          id=1 'Dog-Zen' is stale — added before contact fields existed.
-- Rollback: Manually re-insert id=1 if needed (no data loss — task reassigned to id=3)

-- Reassign the citation task (id=1) from stale Dog-Zen (id=1) to correct record (id=3)
UPDATE public.wpa_tasks
  SET client_id = 3
  WHERE client_id = 1;

-- Delete the stale duplicate
DELETE FROM public.wpa_clients WHERE id = 1;
