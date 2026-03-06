-- Migration: Fix broken trigger on wpa_businesses referencing public.winnow_decisions
-- Date: 2026-03-07
-- Context: After migrating winnow_decisions to wpa.wpa_winnow_decisions, triggers on
--          wpa_businesses referencing the old path broke PATCH operations.

-- Drop any triggers on wpa_businesses that reference the old winnow_decisions path
DO $$
DECLARE
  trig RECORD;
BEGIN
  FOR trig IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'wpa'
      AND event_object_table = 'wpa_businesses'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON wpa.wpa_businesses', trig.trigger_name);
    RAISE NOTICE 'Dropped trigger: %', trig.trigger_name;
  END LOOP;
END;
$$;

-- Drop any orphaned trigger functions referencing public.winnow_decisions
-- (safe to recreate later if needed)
DROP FUNCTION IF EXISTS public.log_winnow_decision() CASCADE;
DROP FUNCTION IF EXISTS wpa.log_winnow_decision() CASCADE;
