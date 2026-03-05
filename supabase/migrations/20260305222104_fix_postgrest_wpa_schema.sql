-- Migration: Fix PostgREST PGRST106 — expose wpa schema to REST API
-- Date: 2026-03-05
-- Rollback: ALTER ROLE authenticator RESET pgrst.db_schemas; NOTIFY pgrst, 'reload config';

-- 1. Add missing service_role grants
GRANT USAGE ON SCHEMA wpa TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA wpa TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA wpa TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA wpa TO service_role;

-- 2. Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA wpa GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA wpa GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA wpa GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 3. Explicitly set pgrst.db_schemas on the authenticator role
-- This is what PostgREST actually reads — dashboard settings may not propagate
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, wpa, turfsheet';

-- 4. Tell PostgREST to reload its config (picks up the new db_schemas)
NOTIFY pgrst, 'reload config';

-- 5. Also reload schema cache (picks up new tables/views in wpa)
NOTIFY pgrst, 'reload schema';
