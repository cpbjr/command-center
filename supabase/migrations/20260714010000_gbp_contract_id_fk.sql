-- Migration: restore FKs on GBP/baseline tables (Phase 2 Step 6)
-- Date: 2026-07-14
-- Context: client_id on these tables is legacy data from the dropped wpa_clients
--   table, NOT a contract id. Only contracts 1,2 exist; client_id=3 is an orphan
--   ("A Dog Zen Salon", a business wrongly added as a client, since removed).
--   The FK constraints were dropped in 20260620043816 on the (false) assumption
--   that contract ids 1,2,3 match old client ids 1,2,3 — but contract 3 was never
--   created. We delete the orphan rows, rename client_id -> contract_id, add a real FK.
-- Note: the plan named 6 tables, but wpa_client_activity was already dropped in
--   20260620044614_drop_legacy_tables.sql. Only 5 tables carry client_id.
-- Rollback: drop the FK + rename contract_id back to client_id per table; deleted
--   rows are recoverable from artifacts/2026-07-14-client_id-3-snapshot.json.
-- Validation: the anti-join at the end MUST return zero rows before the FK is added.

BEGIN;

-- 1) Delete orphaned rows (client_id with no matching contract). We target =3
--    explicitly (the known orphan) rather than a blind anti-join delete, so the
--    delete is auditable against the snapshot.
DELETE FROM wpa.wpa_client_baselines WHERE client_id = 3;
DELETE FROM wpa.wpa_gbp_scores        WHERE client_id = 3;
DELETE FROM wpa.gbp_analytics         WHERE client_id = 3;
DELETE FROM wpa.wpa_gbp_insights      WHERE client_id = 3;
DELETE FROM wpa.wpa_weekly_reports    WHERE client_id = 3;

-- 2) Anti-join guard: fail loudly if ANY orphan remains in ANY table.
DO $$
DECLARE
  v_orphans INT;
BEGIN
  SELECT
    (SELECT count(*) FROM wpa.wpa_client_baselines b LEFT JOIN wpa.wpa_contracts c ON b.client_id = c.id WHERE c.id IS NULL) +
    (SELECT count(*) FROM wpa.wpa_gbp_scores        b LEFT JOIN wpa.wpa_contracts c ON b.client_id = c.id WHERE c.id IS NULL) +
    (SELECT count(*) FROM wpa.gbp_analytics         b LEFT JOIN wpa.wpa_contracts c ON b.client_id = c.id WHERE c.id IS NULL) +
    (SELECT count(*) FROM wpa.wpa_gbp_insights      b LEFT JOIN wpa.wpa_contracts c ON b.client_id = c.id WHERE c.id IS NULL) +
    (SELECT count(*) FROM wpa.wpa_weekly_reports    b LEFT JOIN wpa.wpa_contracts c ON b.client_id = c.id WHERE c.id IS NULL)
  INTO v_orphans;
  IF v_orphans > 0 THEN
    RAISE EXCEPTION 'Aborting: % orphaned client_id rows remain after delete', v_orphans;
  END IF;
END $$;

-- 3) Rename client_id -> contract_id and add a real FK per table.
--    The unique index idx_gbp_insights_client_week (on wpa_gbp_insights) keeps its
--    name but auto-tracks the renamed column; PostgREST onConflict matches on the
--    column names (contract_id,week_ending), so the insights upsert still resolves.
ALTER TABLE wpa.wpa_client_baselines RENAME COLUMN client_id TO contract_id;
ALTER TABLE wpa.wpa_client_baselines
  ADD CONSTRAINT wpa_client_baselines_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES wpa.wpa_contracts(id);

ALTER TABLE wpa.wpa_gbp_scores RENAME COLUMN client_id TO contract_id;
ALTER TABLE wpa.wpa_gbp_scores
  ADD CONSTRAINT wpa_gbp_scores_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES wpa.wpa_contracts(id);

ALTER TABLE wpa.gbp_analytics RENAME COLUMN client_id TO contract_id;
ALTER TABLE wpa.gbp_analytics
  ADD CONSTRAINT gbp_analytics_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES wpa.wpa_contracts(id);

ALTER TABLE wpa.wpa_gbp_insights RENAME COLUMN client_id TO contract_id;
ALTER TABLE wpa.wpa_gbp_insights
  ADD CONSTRAINT wpa_gbp_insights_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES wpa.wpa_contracts(id);

ALTER TABLE wpa.wpa_weekly_reports RENAME COLUMN client_id TO contract_id;
ALTER TABLE wpa.wpa_weekly_reports
  ADD CONSTRAINT wpa_weekly_reports_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES wpa.wpa_contracts(id);

COMMIT;
