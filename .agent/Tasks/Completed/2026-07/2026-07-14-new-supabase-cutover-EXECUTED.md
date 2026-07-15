# Phase 1.5 — New Dedicated WPA Supabase Project + Security Lockdown

**Status: prepared, awaiting execution** (needs Supabase account access + secrets — one sitting, do it after Phase 1 is deployed and verified).

## Why

- The current project (`klyzdnocgrvassppripi`) is **shared** with other apps (`turfsheet`, `crm`, `taskboard` schemas, `public.jobs`/`staff`). The anon key baked into the public dashboard bundle has full read/write on all of it (every RLS policy is `USING (true)` + `GRANT ALL TO anon`).
- A dedicated project shrinks the blast radius and lets us lock down auth from day one instead of retrofitting.
- Verified low-risk: the frontend only uses env vars (no hardcoded project ref), no storage buckets, no edge functions, no auth users to migrate, small data (~2,100 businesses + related rows).
- **Table names stay identical** (`wpa` schema, `wpa_*` tables) — zero code changes in the app or Bob's skill.

## Prepared artifacts (in this repo)

- `supabase/new-project/lockdown_policies.sql` — authenticated-only policies + anon revocation for the new project.
- `src/components/auth/AuthGate.tsx` — login page + session guard, **gated behind `VITE_REQUIRE_AUTH=true`** so the current deployment is unaffected until cutover.

## Runbook

1. **Create the new Supabase project** (dashboard → New project, e.g. `wpa-command-center`). Note the project ref, anon key, and service-role key.
2. **Recreate the schema.** Preferred: dump it from the live old project so nothing drifts (the 58-file migration history does not need to replay):
   ```bash
   npx supabase@latest link --project-ref klyzdnocgrvassppripi
   npx supabase@latest db dump --schema wpa -f wpa_schema.sql        # schema only
   npx supabase@latest db dump --schema wpa --data-only -f wpa_data.sql
   npx supabase@latest link --project-ref <NEW_REF>
   psql "$NEW_DB_URL" -f wpa_schema.sql
   psql "$NEW_DB_URL" -f wpa_data.sql
   ```
   (Run this AFTER the Phase-1 migrations have been applied to the old project so the dump includes assigned_to, wpa_task_events, triggers, and the actor-aware RPCs.)
3. **Expose the `wpa` schema** in the new project: Dashboard → Settings → API → Exposed schemas → add `wpa`. (This repo's `supabase/config.toml` lists the local-dev equivalent; the new project only needs `public` and `wpa`.)
4. **Create the single auth user** (Dashboard → Authentication → Add user): christopher's email + a strong password. Disable public signups (Authentication → Providers → Email → turn off "Allow new users to sign up").
5. **Cut Bob over first** (VPS: `/home/wpauser/.hermes/hermes-agent/skills/wpa-pipeline/SKILL.md` and any env/config holding the Supabase URL/key):
   - New project URL + **service-role key** (never the anon key; service-role bypasses RLS so nothing else changes).
   - While in there, apply the new task protocol (see `.agent/System/bob-task-protocol.md`).
   - Verify: Bob's queue query and one `append_activity` RPC call against the new project.
6. **Lock it down**: run `supabase/new-project/lockdown_policies.sql` against the new project (SQL editor or psql).
7. **Switch the dashboard**: update GitHub Actions secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` to the new project, add `VITE_REQUIRE_AUTH=true` to the build env (`.github/workflows/deploy.yml`), update local `.env`, push/deploy. Log in once and click through Leads/Tasks/Discovery.
8. **Update tooling**: MCP config for `white-pine-projects` → new ref; `CLAUDE.md` Supabase table (ref + URL).
9. **Decommission**: after a comfortable soak (a week), drop the `wpa` schema from the old shared project and rotate the old project's anon key (the old key is permanently public in shipped bundles).

## Rollback

Everything is reversible until step 9: point the secrets/env back at the old project and redeploy; Bob's config likewise. Keep the old project untouched during the soak.

---

## Work log — EXECUTED 2026-07-14

Steps 1–8 done and verified. Step 9 deferred to the soak (~2026-07-21).

- **New project** `cfwaefobqjouyglocuyh` (`aws-1-us-east-1`), old `klyzdnocgrvassppripi` (`aws-1-us-west-1`).
- **DB access gotcha:** no IPv6 locally → direct `db.<ref>.supabase.co` unreachable; used the **session pooler** (`aws-1-<region>.pooler.supabase.com:5432`). Docker default bridge couldn't reach the pooler either → ran `pg_dump`/`psql` from the `postgres:17` image with **`--network host`** (local `pg_dump` was v16, servers are PG17).
- **Step 2 (data):** `pg_dump --schema=wpa` schema-only + data-only (drop `--disable-triggers`; pooler user isn't superuser). Loaded schema then data (`--single-transaction`). **Verified: all 20 tables' row counts match old exactly** (businesses 1904, service_ranks 10269, audits 926, winnow_decisions 273, tasks 40, …); 5 functions, 2 views, 17 sequences with correct `setval`.
- **Step 3:** exposed `wpa` in Data API; granted `USAGE`/`ALL` to `authenticated` + `service_role` (fresh schema had no anon/authenticated grants). Service-role REST verified (count 1904, `append_activity` RPC live).
- **Step 4:** auth user `christopher@whitepineagency.com` created; public signups disabled.
- **Step 5 (Bob):** `ssh wpauser@beefy`. Updated `/home/wpauser/.hermes/.env` (added `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; repointed `SUPABASE_ANON_KEY`→**service-role** since the skill references that var; old anon key kept as `#OLD_…` for rollback) and SKILL.md Base URL → new project. Restarted `systemctl --user restart hermes-gateway`. Verified queue query + a real `append_activity` (then deleted the test row). **Backups:** `.env.bak-cutover-*`, `SKILL.md.bak-cutover-*` on beefy.
  - **FOLLOW-UP (not migration-critical):** `wpa-pipeline/SKILL.md` still has stale stage vocabulary (`identified→new→prospect→qualified→proposal→client`) and is missing `end_engagement`/`dropped_reason`/`p_actor` and the `wpa_task_events` queue protocol from `.agent/System/bob-task-protocol.md`. Modernize separately.
- **Step 6 (lockdown):** ran `supabase/new-project/lockdown_policies.sql`. Verified: **anon denied** (`permission denied for schema wpa`, HTTP 401), **RLS on 20/20 tables** with `authenticated_full_access`, `authenticated` reads+writes OK, service-role OK.
- **Step 7 (dashboard):** set GitHub secrets via `gh` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`→new, `VITE_REQUIRE_AUTH=true`); added `VITE_REQUIRE_AUTH` passthrough in `deploy.yml`; merged `claude/supabase-wpa-cutover`→`main`; CI deploy green. **Verified prod bundle carries new ref, old ref gone, login UI compiled in, anon 401.** Local `.env` repointed (old values kept as comments; `.env.bak-precutover-*`).
- **Step 8 (tooling):** MCP `white-pine-projects` URL → new pooler URL (verified `supabase:sql` → 1904); `CLAUDE.md` ref/URL/link updated. **Backup:** `mcp-servers/config.json.bak-cutover-*`.

### Step 9 — decommission (DEFERRED, do ~2026-07-21 after soak)

1. Confirm no regressions during the week (dashboard + Bob on new project).
2. `DROP SCHEMA wpa CASCADE` on the **old** project `klyzdnocgrvassppripi` (leave other schemas: turfsheet/taskboard/etc.).
3. **Rotate the old project's anon key** — it's permanently public in already-shipped bundles.
4. Remove the `#OLD_…` rollback comments from beefy `.env` and local `.env`; delete `*.bak-cutover-*` / `*.bak-precutover-*`.
