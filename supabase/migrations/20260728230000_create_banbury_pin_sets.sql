-- Migration: Banbury course map pin sets (Phase 2 refine)
-- Project: cfwaefobqjouyglocuyh (live CC)
-- Schema: wpa only
-- Rollback:
--   DROP FUNCTION IF EXISTS wpa.banbury_pin_set_by_token(text);
--   DROP FUNCTION IF EXISTS wpa.banbury_pin_sets_set_updated_at();
--   DROP TABLE IF EXISTS wpa.banbury_pin_sets;

-- One row = one play_date pin set (daily / tournament). No multi-event parent table (YAGNI).
CREATE TABLE IF NOT EXISTS wpa.banbury_pin_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_date date NOT NULL,
  label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'active', 'archived')),
  start_hole int NOT NULL DEFAULT 1
    CHECK (start_hole >= 1 AND start_hole <= 18),
  -- pins: object keyed by hole "1".."18" → { hole, lat, lng, onYd, lrYd, lrSide, lrLabel, onLabel, depthYd, depthLabel, ... }
  pins jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- avoid: { course: [{ kind, note? }], holes: { "3": [{ kind, note? }] } }
  avoid jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_token text UNIQUE,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS banbury_pin_sets_play_date_idx
  ON wpa.banbury_pin_sets (play_date DESC);

CREATE INDEX IF NOT EXISTS banbury_pin_sets_status_idx
  ON wpa.banbury_pin_sets (status);

COMMENT ON TABLE wpa.banbury_pin_sets IS
  'BanBury Golf Course pin sheets (Plan 04). Staff CRUD via ops map anon key; public single-set read only via banbury_pin_set_by_token(public_token).';

CREATE OR REPLACE FUNCTION wpa.banbury_pin_sets_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS banbury_pin_sets_updated_at ON wpa.banbury_pin_sets;
CREATE TRIGGER banbury_pin_sets_updated_at
  BEFORE UPDATE ON wpa.banbury_pin_sets
  FOR EACH ROW
  EXECUTE FUNCTION wpa.banbury_pin_sets_set_updated_at();

ALTER TABLE wpa.banbury_pin_sets ENABLE ROW LEVEL SECURITY;

-- Staff / ops write+list path:
--   Static banbury-map serves supabaseAnonKey from server-only config.js (same pattern as Maps browser key).
--   Anon may full-access THIS table only — not other wpa.* CRM tables (those stay authenticated-only).
--   Optional accessCode gate on the map UI is soft; treat anon key as ops credential.
DROP POLICY IF EXISTS banbury_pin_sets_anon_all ON wpa.banbury_pin_sets;
CREATE POLICY banbury_pin_sets_anon_all
  ON wpa.banbury_pin_sets
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS banbury_pin_sets_authenticated_all ON wpa.banbury_pin_sets;
CREATE POLICY banbury_pin_sets_authenticated_all
  ON wpa.banbury_pin_sets
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Table privileges: banbury_pin_sets only (do not blanket-grant other wpa tables to anon)
GRANT USAGE ON SCHEMA wpa TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wpa.banbury_pin_sets TO anon, authenticated;
GRANT ALL ON TABLE wpa.banbury_pin_sets TO service_role;

-- Public handout path: single set by unguessable token (SECURITY DEFINER bypasses RLS intentionally).
-- Does NOT list all sets. Call: GET /rest/v1/rpc/banbury_pin_set_by_token with { "p_token": "..." }
CREATE OR REPLACE FUNCTION wpa.banbury_pin_set_by_token(p_token text)
RETURNS SETOF wpa.banbury_pin_sets
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = wpa, public
AS $$
  SELECT *
  FROM wpa.banbury_pin_sets
  WHERE public_token IS NOT NULL
    AND public_token = p_token
    AND length(trim(p_token)) >= 16
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION wpa.banbury_pin_set_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION wpa.banbury_pin_set_by_token(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION wpa.banbury_pin_set_by_token(text) IS
  'Public read of one Banbury pin set by unguessable public_token. No list endpoint.';
