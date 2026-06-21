-- Migration: move_to_stage RPC
-- Date: 2026-06-21
-- Rollback: DROP FUNCTION wpa.move_to_stage;

CREATE OR REPLACE FUNCTION wpa.move_to_stage(
  p_business_id TEXT,
  p_stage       TEXT
)
RETURNS wpa.wpa_businesses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wpa
AS $$
DECLARE
  v_business wpa.wpa_businesses;
BEGIN
  UPDATE wpa.wpa_businesses
    SET lifecycle_stage = p_stage::wpa.lifecycle_stage
  WHERE id = p_business_id
  RETURNING * INTO v_business;

  INSERT INTO wpa.wpa_activity (business_id, type, summary)
    VALUES (p_business_id, 'stage_change', 'Stage moved to ' || p_stage);

  RETURN v_business;
END;
$$;

GRANT EXECUTE ON FUNCTION wpa.move_to_stage TO anon, authenticated;
