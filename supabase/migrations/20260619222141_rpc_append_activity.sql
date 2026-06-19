-- Migration: append_activity RPC
-- Rollback: DROP FUNCTION wpa.append_activity;

CREATE OR REPLACE FUNCTION wpa.append_activity(
  p_business_id TEXT,
  p_type        TEXT,
  p_summary     TEXT,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS wpa.wpa_activity
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wpa
AS $$
DECLARE
  v_activity wpa.wpa_activity;
BEGIN
  INSERT INTO wpa.wpa_activity (business_id, type, summary, occurred_at)
    VALUES (p_business_id, p_type, p_summary, p_occurred_at)
  RETURNING * INTO v_activity;

  RETURN v_activity;
END;
$$;

GRANT EXECUTE ON FUNCTION wpa.append_activity TO anon, authenticated;
