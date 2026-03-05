# Cleanup: Remove OC Bob Shim View

## Context

OC Bob currently queries `GET /rest/v1/wpa_tasks` without an `Accept-Profile: wpa` header, hitting a shim view in `public` that proxies to `wpa.wpa_tasks`. Now that PostgREST serves the `wpa` schema directly, Bob should be updated to use `Accept-Profile: wpa` and the shim can be dropped.

**Prerequisite:** Christopher tells OC Bob to add `Accept-Profile: wpa` header to his REST API calls.

## Plan

### Step 1: Create migration to drop the shim view

**File:** `supabase/migrations/<timestamp>_drop_bob_shim_view.sql`

```sql
-- Migration: Drop OC Bob compatibility shim (no longer needed)
-- Date: 2026-03-05
-- Prerequisite: OC Bob updated to send Accept-Profile: wpa header
-- Rollback: CREATE VIEW public.wpa_tasks AS SELECT * FROM wpa.wpa_tasks;
--           GRANT SELECT, UPDATE ON public.wpa_tasks TO anon, authenticated;

DROP VIEW IF EXISTS public.wpa_tasks;
```

That's it — one line. The other tables in `public` (contacts, deals, companies, etc.) belong to other projects and stay untouched.

### Step 2: Push migration

```bash
npx supabase@latest db push
```

### Step 3: Verify

```bash
# Bob's new way should work:
curl -s ".../rest/v1/wpa_tasks?limit=1" -H "Accept-Profile: wpa" -H "apikey: ..."

# Old way (no Accept-Profile) should now 404 or error:
curl -s ".../rest/v1/wpa_tasks?limit=1" -H "apikey: ..."
```

## Key Files
- Shim to drop: `supabase/migrations/20260305062827_bob_compat_shim.sql` (original creation)
- New migration: `supabase/migrations/<timestamp>_drop_bob_shim_view.sql`
