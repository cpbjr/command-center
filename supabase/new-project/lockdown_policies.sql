-- New-project security lockdown — run ONLY on the dedicated WPA Supabase
-- project, AFTER the baseline schema + data restore, and AFTER Bob's skill
-- has been switched to the service-role key.
--
-- Effect: the anon key (shipped in the public dashboard bundle) loses all
-- access. Reads/writes require a signed-in user (the dashboard, via
-- VITE_REQUIRE_AUTH=true) or the service-role key (Bob, VPS-only, bypasses
-- RLS entirely).
--
-- See .agent/Tasks/Implementation/2026-07-13-new-supabase-cutover.md for the
-- full runbook and ordering.

-- 1. Replace every permissive policy with authenticated-only
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies WHERE schemaname = 'wpa'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;

  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'wpa'
  LOOP
    EXECUTE format('ALTER TABLE wpa.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format(
      'CREATE POLICY "authenticated_full_access" ON wpa.%I
         FOR ALL TO authenticated USING (true) WITH CHECK (true)', r.tablename);
  END LOOP;
END $$;

-- 2. Revoke every anon grant in the wpa schema
REVOKE ALL ON ALL TABLES IN SCHEMA wpa FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA wpa FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA wpa FROM anon;
REVOKE USAGE ON SCHEMA wpa FROM anon;

-- 3. Make sure authenticated keeps what it needs
GRANT USAGE ON SCHEMA wpa TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA wpa TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA wpa TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA wpa TO authenticated;

-- 4. Future objects default the same way
ALTER DEFAULT PRIVILEGES IN SCHEMA wpa REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA wpa REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA wpa REVOKE ALL ON FUNCTIONS FROM anon;
