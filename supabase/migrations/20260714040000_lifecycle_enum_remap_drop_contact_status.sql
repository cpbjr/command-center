-- Migration: remap lifecycle_stage to final vocabulary + drop contact_status
--   (Phase 2 Step 5, Tasks 5.9 + 5.10 combined — GATED, gate satisfied 2026-07-14)
-- Date: 2026-07-14
-- PREREQUISITE (met): Bob's VPS skill re-synced to protocol v2 — writes the new
--   lifecycle_stage values and no longer reads/writes contact_status. Hard cutover.
--
-- WHY COMBINED: the plan split these as 5.9 (enum remap) then 5.10 (drop the
--   contact_status sync trigger + mapping functions). But wpa.contact_status_from_stage()
--   takes wpa.lifecycle_stage as a PARAMETER type, and wpa.sync_pipeline_fields()
--   (the trigger fn) calls it — so DROP TYPE lifecycle_stage is BLOCKED by those
--   dependencies. The trigger + mapping functions must be dropped BEFORE the enum
--   is rebuilt. Since Bob is off contact_status there is no reason to keep the
--   mirror alive through the remap, so both steps land atomically here.
--
-- Rollback: restore lifecycle_stage from
--   artifacts/2026-07-14-lifecycle-stage-pre-remap-snapshot.json; re-add contact_status
--   and the sync trigger/functions from 20260713010100_unify_pipeline_sync.sql.
--   (ALTER TYPE cannot un-drop enum values — a full type rebuild would be needed.)
--   The two dropped public views were untracked legacy debris (see step 2); not
--   restored — the app never used them and the wpa schema is authoritative.

BEGIN;

-- 1) Drop the contact_status sync infrastructure. These reference the old enum
--    values and (contact_status_from_stage) depend on the enum type itself, so
--    they must go before the type is rebuilt.
DROP TRIGGER IF EXISTS trg_a_sync_pipeline ON wpa.wpa_businesses;
DROP FUNCTION IF EXISTS wpa.sync_pipeline_fields();
DROP FUNCTION IF EXISTS wpa.stage_from_contact_status(TEXT);
DROP FUNCTION IF EXISTS wpa.contact_status_from_stage(wpa.lifecycle_stage);

-- 2) Views that read wpa_businesses.contact_status / lifecycle_stage block both the
--    column drop and the enum remap. Drop them all up front:
--    - wpa.wpa_businesses_with_score — app-used; RECREATED at the end (post-remap).
--    - public.businesses_with_crm_status — legacy PUBLIC-schema debris: untracked
--      (in no migration), unused by the app, reads wpa.wpa_businesses. The wpa schema
--      is authoritative; the public originals were meant to be gone (an earlier
--      migration already dropped public.businesses_with_score). DROP, do NOT recreate.
DROP VIEW IF EXISTS public.businesses_with_crm_status;
DROP VIEW IF EXISTS public.businesses_with_score;
DROP VIEW IF EXISTS wpa.wpa_businesses_with_score;

-- Drop the legacy contact_status column (+ its check constraint, dropped with it).
ALTER TABLE wpa.wpa_businesses DROP COLUMN contact_status;

-- 3) Remap existing rows to the target set. Cast the column to TEXT first so we
--    can assign values not present in the current single enum.
ALTER TABLE wpa.wpa_businesses
  ALTER COLUMN lifecycle_stage DROP DEFAULT,
  ALTER COLUMN lifecycle_stage TYPE TEXT;

UPDATE wpa.wpa_businesses SET lifecycle_stage = 'new_prospect'
  WHERE lifecycle_stage IN ('new','prospect');
UPDATE wpa.wpa_businesses SET lifecycle_stage = 'lead'
  WHERE lifecycle_stage IN ('qualified','proposal');   -- 'lead' stays 'lead'
UPDATE wpa.wpa_businesses SET lifecycle_stage = 'relationship_ended'
  WHERE lifecycle_stage = 'churned';
-- 'identified', 'client', 'dropped' unchanged.

-- Guard: fail loudly if any value outside the target set remains.
DO $$
DECLARE v_bad INT;
BEGIN
  SELECT count(*) INTO v_bad FROM wpa.wpa_businesses
  WHERE lifecycle_stage NOT IN
    ('identified','new_prospect','lead','client','dropped','relationship_ended');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Aborting: % rows carry a lifecycle_stage outside the target set', v_bad;
  END IF;
END $$;

-- 4) Rebuild the enum type with exactly the target values.
DROP TYPE IF EXISTS wpa.lifecycle_stage_new;
CREATE TYPE wpa.lifecycle_stage_new AS ENUM
  ('identified','new_prospect','lead','client','dropped','relationship_ended');

ALTER TABLE wpa.wpa_businesses
  ALTER COLUMN lifecycle_stage TYPE wpa.lifecycle_stage_new
    USING lifecycle_stage::wpa.lifecycle_stage_new,
  ALTER COLUMN lifecycle_stage SET DEFAULT 'identified';

-- 5) Swap type names. move_to_stage / convert_to_client / end_engagement cast
--    p_stage::wpa.lifecycle_stage — the name is unchanged after the rename, so
--    they keep working (and now resolve new_prospect / relationship_ended).
DROP TYPE wpa.lifecycle_stage;
ALTER TYPE wpa.lifecycle_stage_new RENAME TO lifecycle_stage;

-- 6) Recreate the app's score view now that the column set is final (no
--    contact_status; lifecycle_stage is the rebuilt enum). SELECT b.* so it tracks
--    the current columns, per the established refresh pattern.
CREATE VIEW wpa.wpa_businesses_with_score AS
SELECT b.*, a.score AS latest_score
FROM wpa.wpa_businesses b
LEFT JOIN LATERAL (
  SELECT score FROM wpa.wpa_audits
  WHERE business_id = b.id
  ORDER BY audited_at DESC
  LIMIT 1
) a ON true;
GRANT SELECT ON wpa.wpa_businesses_with_score TO anon, authenticated;

COMMIT;
