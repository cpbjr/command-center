-- Migration: Recreate wpa_businesses_with_score to include folder_path
-- Date: 2026-03-15
-- Reason: View uses SELECT b.* and must be recreated to pick up new folder_path column

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
