# Fix PGRST106: PostgREST Not Serving `wpa` Schema

## Context

All tables have been migrated from `public` to `wpa` schema, grants are in place for `anon`/`authenticated`, the dashboard shows `wpa` as an exposed schema, and the app is configured with `db: { schema: 'wpa' }`. But the REST API returns PGRST106 ("The schema must be one of the following: public, turfsheet") — PostgREST doesn't know about `wpa`.

**Root cause:** The `authenticator` role's `pgrst.db_schemas` setting doesn't include `wpa`. The dashboard UI may show it as exposed, but PostgREST reads from the role-level config, which is stale. None of the previous attempts (dashboard toggles, project restart, config push) addressed this SQL-level setting.

Additionally, `service_role` is missing from the schema grants, which could cause issues for admin operations.

## Plan

### Step 1: Create a new migration to fix PostgREST config

**File:** `supabase/migrations/<timestamp>_fix_postgrest_wpa_schema.sql`

```sql
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
```

### Step 2: Push the migration

```bash
npx supabase@latest db push
```

### Step 3: Verify the fix

```bash
# Test with curl — should return task data, not PGRST106
curl -s "https://klyzdnocgrvassppripi.supabase.co/rest/v1/wpa_tasks?limit=1" \
  -H "Accept-Profile: wpa" \
  -H "apikey: <anon_key>"
```

### Step 4: If NOTIFY didn't take effect via migration

NOTIFY commands in migrations may not work because they execute in a transaction that hasn't committed yet when PostgREST receives the signal. If Step 3 still fails:

Run these manually via the Supabase SQL Editor (dashboard):
```sql
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
```

### Step 5: If still failing — nuclear option

As a last resort, per [Supabase docs](https://supabase.com/docs/guides/troubleshooting/pgrst106-the-schema-must-be-one-of-the-following-error-when-querying-an-exposed-schema):

```sql
-- Reset to let dashboard config take over
ALTER ROLE authenticator RESET pgrst.db_schemas;
NOTIFY pgrst, 'reload config';
```

Then re-save the exposed schemas in the dashboard.

### Step 6: Update Blocked.md

Remove the blocked entry and document resolution.

## Key Files
- New migration: `supabase/migrations/<timestamp>_fix_postgrest_wpa_schema.sql`
- Existing migration: [migrate_public_to_wpa_schema.sql](supabase/migrations/20260305062414_migrate_public_to_wpa_schema.sql)
- Client config: [supabase.ts](src/lib/supabase.ts)
- Blocked doc: [Blocked.md](.agent/Tasks/Blocked.md)

## Verification
1. `curl` with `Accept-Profile: wpa` returns data (not PGRST106)
2. Run `npm run dev` locally and verify the dashboard loads data
3. Build passes: `npm run build`

## Sources
- [Supabase PGRST106 Troubleshooting](https://supabase.com/docs/guides/troubleshooting/pgrst106-the-schema-must-be-one-of-the-following-error-when-querying-an-exposed-schema)
- [Using Custom Schemas](https://supabase.com/docs/guides/api/using-custom-schemas)
- [Refresh PostgREST Schema](https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema)
- [GitHub Discussion #2528](https://github.com/orgs/supabase/discussions/2528)
- [PostgREST Schema Cache Issue #42183](https://github.com/supabase/supabase/issues/42183)
