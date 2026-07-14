-- Migration: add actor attribution to the agent-facing RPCs
--
-- CONTEXT.md always documented append_activity(...) with an actor param that
-- never existed. This adds it for real, plus the same on move_to_stage.
-- Trailing params with defaults keep existing callers (Bob's live skill)
-- working unchanged.
--
-- DROP + CREATE rather than CREATE OR REPLACE: a changed arg list would create
-- an overload, and two overloads reachable with the same named args make
-- PostgREST RPC calls ambiguous (hard failure for every caller).
--
-- Default actor is 'bob' because RPC callers are agents; the UI passes
-- p_actor: 'human' explicitly (and direct table inserts default to 'human'
-- via the column default).
--
-- Rollback: restore the versions from 20260619222141 / 20260621022252.

DROP FUNCTION IF EXISTS wpa.append_activity(TEXT, TEXT, TEXT, TIMESTAMPTZ);

CREATE FUNCTION wpa.append_activity(
  p_business_id TEXT,
  p_type        TEXT,
  p_summary     TEXT,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW(),
  p_actor       TEXT DEFAULT 'bob'
)
RETURNS wpa.wpa_activity
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wpa
AS $$
DECLARE
  v_activity wpa.wpa_activity;
BEGIN
  INSERT INTO wpa.wpa_activity (business_id, type, summary, occurred_at, actor)
    VALUES (p_business_id, p_type, p_summary, p_occurred_at, p_actor)
  RETURNING * INTO v_activity;

  RETURN v_activity;
END;
$$;

GRANT EXECUTE ON FUNCTION wpa.append_activity TO anon, authenticated;

DROP FUNCTION IF EXISTS wpa.move_to_stage(TEXT, TEXT);

CREATE FUNCTION wpa.move_to_stage(
  p_business_id TEXT,
  p_stage       TEXT,
  p_actor       TEXT DEFAULT 'bob'
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

  INSERT INTO wpa.wpa_activity (business_id, type, summary, actor)
    VALUES (p_business_id, 'stage_change', 'Stage moved to ' || p_stage, p_actor);

  RETURN v_business;
END;
$$;

GRANT EXECUTE ON FUNCTION wpa.move_to_stage TO anon, authenticated;

DROP FUNCTION IF EXISTS wpa.convert_to_client(TEXT, TEXT, NUMERIC);

CREATE FUNCTION wpa.convert_to_client(
  p_business_id     TEXT,
  p_service_tier    TEXT,
  p_monthly_revenue NUMERIC DEFAULT 0,
  p_actor           TEXT DEFAULT 'bob'
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

  INSERT INTO wpa.wpa_activity (business_id, type, summary, actor)
    VALUES (p_business_id, 'stage_change', 'Converted to client — ' || p_service_tier, p_actor);

  RETURN v_contract;
END;
$$;

GRANT EXECUTE ON FUNCTION wpa.convert_to_client TO anon, authenticated;
