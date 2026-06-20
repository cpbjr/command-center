-- Migration: convert_to_client RPC
-- Rollback: DROP FUNCTION wpa.convert_to_client;

CREATE OR REPLACE FUNCTION wpa.convert_to_client(
  p_business_id     TEXT,
  p_service_tier    TEXT,
  p_monthly_revenue NUMERIC DEFAULT 0
)
RETURNS wpa.wpa_contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wpa
AS $$
DECLARE
  v_contract wpa.wpa_contracts;
BEGIN
  UPDATE wpa.wpa_businesses
    SET lifecycle_stage = 'client'
  WHERE id = p_business_id;

  INSERT INTO wpa.wpa_contracts (business_id, service_tier, monthly_revenue)
    VALUES (p_business_id, p_service_tier, p_monthly_revenue)
  RETURNING * INTO v_contract;

  INSERT INTO wpa.wpa_activity (business_id, type, summary)
    VALUES (p_business_id, 'stage_change', 'Converted to client — ' || p_service_tier);

  RETURN v_contract;
END;
$$;

GRANT EXECUTE ON FUNCTION wpa.convert_to_client TO anon, authenticated;
