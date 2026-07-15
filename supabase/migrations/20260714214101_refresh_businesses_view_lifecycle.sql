-- Migration: Recreate wpa_businesses_with_score to expose lifecycle_stage + dropped_reason
-- Date: 2026-07-14
-- Reason: View snapshotted columns before lifecycle_stage/dropped_reason existed on
--         wpa_businesses; even though the view is SELECT b.*, Postgres views freeze
--         their column list at CREATE time and must be recreated to pick up new columns.
-- Rollback: re-run supabase/migrations/20260315212922_refresh_businesses_view.sql

DROP VIEW IF EXISTS wpa.wpa_businesses_with_score;

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
