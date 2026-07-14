-- Migration: unify the two pipeline fields on wpa_businesses
--
-- Problem: the UI reads/writes contact_status (legacy CHECK column) while the
-- agent writes lifecycle_stage via move_to_stage(). The two silently diverge.
--
-- Decision: lifecycle_stage is authoritative. contact_status becomes a synced
-- legacy mirror until the UI migrates to lifecycle_stage (Phase 2), then both
-- the column and the sync trigger get dropped.
--
-- Verification query (run before and after):
--   SELECT contact_status, lifecycle_stage, count(*)
--   FROM wpa.wpa_businesses GROUP BY 1, 2 ORDER BY 1, 2;
--
-- Rollback: DROP TRIGGER trg_a_sync_pipeline ON wpa.wpa_businesses;
--           DROP FUNCTION wpa.sync_pipeline_fields(),
--                         wpa.stage_from_contact_status(TEXT),
--                         wpa.contact_status_from_stage(wpa.lifecycle_stage);
--           ALTER TABLE wpa.wpa_businesses ALTER COLUMN lifecycle_stage SET DEFAULT 'lead';

-- Mapping helpers (used by the trigger and the backfill)
CREATE OR REPLACE FUNCTION wpa.stage_from_contact_status(p_status TEXT)
RETURNS wpa.lifecycle_stage
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_status
    WHEN 'IDENTIFIED' THEN 'identified'
    WHEN 'NEW'        THEN 'new'
    WHEN 'TARGETED'   THEN 'prospect'
    WHEN 'CONTACTED'  THEN 'qualified'
    WHEN 'REPLIED'    THEN 'qualified'
    WHEN 'CLOSED'     THEN 'churned'
    WHEN 'CLOSED-WON' THEN 'client'
    ELSE 'identified'
  END::wpa.lifecycle_stage
$$;

CREATE OR REPLACE FUNCTION wpa.contact_status_from_stage(p_stage wpa.lifecycle_stage)
RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_stage::text
    WHEN 'identified' THEN 'IDENTIFIED'
    WHEN 'new'        THEN 'NEW'
    WHEN 'prospect'   THEN 'TARGETED'
    WHEN 'qualified'  THEN 'CONTACTED'
    WHEN 'proposal'   THEN 'REPLIED'
    WHEN 'lead'       THEN 'REPLIED'
    WHEN 'client'     THEN 'CLOSED-WON'
    WHEN 'churned'    THEN 'CLOSED'
  END
$$;

-- Whichever field a writer changed, mirror it to the other.
CREATE OR REPLACE FUNCTION wpa.sync_pipeline_fields() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- New rows (Bud discoveries) carry contact_status; derive the stage unless
    -- the insert explicitly set a non-default lifecycle_stage.
    IF NEW.lifecycle_stage = 'identified' THEN
      NEW.lifecycle_stage := wpa.stage_from_contact_status(NEW.contact_status);
    ELSE
      NEW.contact_status := wpa.contact_status_from_stage(NEW.lifecycle_stage);
    END IF;
  ELSIF NEW.lifecycle_stage IS DISTINCT FROM OLD.lifecycle_stage THEN
    NEW.contact_status := wpa.contact_status_from_stage(NEW.lifecycle_stage);
  ELSIF NEW.contact_status IS DISTINCT FROM OLD.contact_status THEN
    NEW.lifecycle_stage := wpa.stage_from_contact_status(NEW.contact_status);
  END IF;
  RETURN NEW;
END;
$$;

-- Named trg_a_* to fire before trg_set_updated_at (alphabetical order among
-- BEFORE triggers).
DROP TRIGGER IF EXISTS trg_a_sync_pipeline ON wpa.wpa_businesses;
CREATE TRIGGER trg_a_sync_pipeline
  BEFORE INSERT OR UPDATE ON wpa.wpa_businesses
  FOR EACH ROW EXECUTE FUNCTION wpa.sync_pipeline_fields();

-- New discoveries default to the start of the pipeline, matching
-- contact_status's default of IDENTIFIED (the lead-gate migration).
ALTER TABLE wpa.wpa_businesses
  ALTER COLUMN lifecycle_stage SET DEFAULT 'identified';

-- One-time backfill. lifecycle_stage defaulted to 'lead' for every row when
-- the column was added, so any row still at 'lead' without a contract is a
-- stale default — remap it from contact_status. Rows with contracts and rows
-- where lifecycle_stage was deliberately moved keep their stage; the trigger
-- refreshes their contact_status mirror on the next update.
ALTER TABLE wpa.wpa_businesses DISABLE TRIGGER trg_a_sync_pipeline;

UPDATE wpa.wpa_businesses b
SET lifecycle_stage = wpa.stage_from_contact_status(b.contact_status)
WHERE b.lifecycle_stage = 'lead'
  AND NOT EXISTS (
    SELECT 1 FROM wpa.wpa_contracts c WHERE c.business_id = b.id
  );

-- Mirror contact_status from the (now authoritative) stage wherever the two
-- currently disagree, so the columns start out consistent.
UPDATE wpa.wpa_businesses
SET contact_status = wpa.contact_status_from_stage(lifecycle_stage)
WHERE contact_status IS DISTINCT FROM wpa.contact_status_from_stage(lifecycle_stage)
  AND NOT (contact_status = 'REPLIED' AND lifecycle_stage IN ('qualified', 'proposal', 'lead'))
  AND NOT (contact_status = 'CONTACTED' AND lifecycle_stage = 'qualified');

ALTER TABLE wpa.wpa_businesses ENABLE TRIGGER trg_a_sync_pipeline;
