-- Migration: expand lifecycle_stage enum and fix move_to_stage cast
-- Date: 2026-06-21
-- Rollback: Cannot remove enum values; to rollback move_to_stage, restore prior version

-- Add pipeline stages (lead/client/churned already exist)
ALTER TYPE wpa.lifecycle_stage ADD VALUE IF NOT EXISTS 'identified';
ALTER TYPE wpa.lifecycle_stage ADD VALUE IF NOT EXISTS 'new';
ALTER TYPE wpa.lifecycle_stage ADD VALUE IF NOT EXISTS 'prospect';
ALTER TYPE wpa.lifecycle_stage ADD VALUE IF NOT EXISTS 'qualified';
ALTER TYPE wpa.lifecycle_stage ADD VALUE IF NOT EXISTS 'proposal';

-- Fix move_to_stage to cast text param to enum type
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
