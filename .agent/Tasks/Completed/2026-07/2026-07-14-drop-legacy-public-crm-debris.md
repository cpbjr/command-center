# Drop legacy `public` + `crm` debris (in-place on old project)

**Date:** 2026-07-14
**Branch:** `claude/phase-2-steps-5-6`
**Project (OLD, shared):** `klyzdnocgrvassppripi`
**Status:** ✅ COMPLETE (executed & verified 2026-07-14)

## Work log (2026-07-14)

Applied via `supabase db push --include-all` as migration
`20260714050000_drop_legacy_public_crm_debris.sql`. `DROP SCHEMA crm CASCADE` cascaded to 30 objects.

Post-migration verification (all green): `crm` schema gone (0); public CRM passthrough views gone (0);
`public.winnow_performance` gone (0); **`wpa.winnow_performance` exists with 7 rows** (data preserved);
all 8 stale CC duplicate tables gone (0); 3 CRM-orphan public functions gone (0); 2 `auth.users` CRM
triggers gone (0). Left intact as intended: `public.jobs`/`staff`/`daily_costs` (3), shared functions
`update_updated_at_column`/`update_user_activity`/`is_admin` (3). `npm run build` green.

**Deviation from handoff:** dropped **8** stale CC tables, not 6 — live verification found
`public.wpa_contacts` + `public.wpa_contact_notes` (both 0 rows) beyond the handoff's list. Owner
approved the full 8-table set before push.

**Skill note:** `/winnow review` needed NO edit — the MCP `white-pine-projects` config already
defaults to `schema: wpa`, so its `winnow_performance` query resolves to the new `wpa` view.

## Context

Command Center uses the `wpa` schema exclusively. The shared Supabase project `klyzdnocgrvassppripi`
also carries legacy debris: an empty Atomic CRM install (`crm` schema + `public` passthrough views),
stale pre-migration CC table duplicates in `public`, and other-project data. This drops the CC/CRM
debris in-place to shrink the surface before the eventual migration of **only** `wpa` to the dedicated
WPA project `cfwaefobqjouyglocuyh` (separate later effort — see [[wpa-supabase-migration-target]]).

Owner decisions (2026-07-14): drop CRM; drop all stale CC duplicates (CASCADE); leave
BanburyMaintenance / `daily_costs` alone; recreate `winnow_performance` in `wpa`.

## Live-verified facts (2026-07-14, via public.execute_sql RPC + PostgREST count=exact)

- All `crm.*` tables and `public` CRM views: **0 rows** (empty scaffold).
- Stale CC duplicates in `public` (all superseded by `wpa.*`): `businesses`(0), `audits`(0),
  `wpa_contacts`(0), `wpa_contact_notes`(0), `wpa_clients`(2), `wpa_projects`(4), `wpa_tasks`(5).
  **8 tables**, not the 6 in the handoff (`wpa_contact_notes` + `wpa_contacts` both present).
- `public.winnow_performance` (7 rows) = pure GROUP BY over `wpa.wpa_winnow_decisions`. That table
  has all 5 columns the view reads (`winnow_score, decision, haiku_decision, outcome_actual,
  override_by_human`). **Regenerable — recreate in `wpa`, zero data loss.**
- **Two live triggers on `auth.users`** call `crm` functions: `on_auth_user_created`→`crm.handle_new_user`,
  `on_auth_user_updated`→`crm.handle_update_user`. Must drop these BEFORE `DROP SCHEMA crm`.
- **`public` utility functions shared by OTHER projects — DO NOT DROP:**
  `update_updated_at_column` (used by `maintenance_log`, `taskboard` triggers),
  `update_user_activity` (used by `maintenance_log`), `is_admin` (3 dependents — RLS).
- **CRM-orphan `public` functions (1 dependent = their crm trigger, safe once CRM gone):**
  `handle_company_saved`, `handle_contact_saved`, `handle_contact_note_created_or_updated`.
- **Leave alone (0 dependents but ambiguous ownership / harmless):** `set_sales_id_default`,
  `merge_contacts`, `get_avatar_for_email`, `get_domain_favicon`, `get_user_id_by_email`, `execute_sql`,
  `sync_winnow_outcome_fn`. Not part of this drop — out of scope, no cost to leaving.
- **NOT TOUCHED (other projects):** `public.jobs`, `public.staff`, `public.daily_costs`,
  schemas `maintenance_log`, `taskboard`.

## Recovery

Full DDL+data snapshot committed: `.agent/Tasks/Implementation/artifacts/2026-07-14-public-crm-legacy-snapshot.sql`.

## Execution steps

1. **Recreate `winnow_performance` in `wpa`** → verify: `select count(*) from wpa.winnow_performance` = 7.
2. **Update `/winnow review`** skill command to read `wpa.winnow_performance` (Accept-Profile: wpa)
   instead of `public.winnow_performance` → verify: grep skill file.
3. **Drop the 2 `auth.users` triggers** (`on_auth_user_created`, `on_auth_user_updated`)
   → verify: re-run auth-trigger introspection = empty.
4. **`DROP SCHEMA crm CASCADE`** (removes crm tables, seqs, 4 crm funcs, crm triggers, and the
   `public` CRM passthrough views via cascade) → verify: `crm` schema gone; public CRM views gone.
5. **Drop CRM-orphan public functions** `handle_company_saved`, `handle_contact_saved`,
   `handle_contact_note_created_or_updated` (now 0 dependents) → verify: gone.
6. **Drop `public.winnow_performance`** (superseded by `wpa` version) → verify: gone.
7. **`DROP TABLE ... CASCADE`** the 8 stale CC duplicates in `public` → verify: all gone.
8. **Full verification sweep** → build stays green (`npm run build`); CC app unaffected (wpa-only).

## Rollback

Forward-only: recreate from the committed snapshot SQL. CRM was empty, so only the `wpa`
`winnow_performance` view + the (empty) CRM scaffold would need re-applying — none carry data.
