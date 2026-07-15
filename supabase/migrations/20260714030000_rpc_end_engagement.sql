-- Migration: end_engagement RPC (Phase 2 Step 5)
-- Date: 2026-07-14
-- Rollback: DROP FUNCTION wpa.end_engagement(TEXT, TEXT, TEXT);
-- Sets a former client's stage to relationship_ended, stamps close_reason/closed_at
-- on their most-recent contract, and logs a stage-change activity entry.
-- Mirrors convert_to_client on the client-exit side; p_actor defaults to 'bob'
-- (agent callers), the UI passes 'human'.

CREATE OR REPLACE FUNCTION wpa.end_engagement(
  p_business_id  TEXT,
  p_close_reason TEXT,
  p_actor        TEXT DEFAULT 'bob'
)
RETURNS wpa.wpa_contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wpa
AS $$
DECLARE
  v_contract wpa.wpa_contracts;
BEGIN
  IF p_close_reason NOT IN ('work_completed','parted_ways') THEN
    RAISE EXCEPTION 'invalid close_reason: %', p_close_reason;
  END IF;

  UPDATE wpa.wpa_businesses
    SET lifecycle_stage = 'relationship_ended'
  WHERE id = p_business_id;

  -- Stamp the most-recent contract for this business.
  UPDATE wpa.wpa_contracts
    SET close_reason = p_close_reason,
        closed_at    = NOW()
  WHERE id = (
    SELECT id FROM wpa.wpa_contracts
    WHERE business_id = p_business_id
    ORDER BY created_at DESC
    LIMIT 1
  )
  RETURNING * INTO v_contract;

  INSERT INTO wpa.wpa_activity (business_id, type, summary, actor)
    VALUES (p_business_id, 'stage_change',
            'Engagement ended — ' || p_close_reason, p_actor);

  RETURN v_contract;
END;
$$;

GRANT EXECUTE ON FUNCTION wpa.end_engagement TO anon, authenticated;
