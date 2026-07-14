# Completed — Agent-First Phase 1: High-Impact Fixes + Agent Surface

**Date:** 2026-07-13/14
**Branch:** `claude/code-review-hermes-optimization-qxyg6e`
**Plan:** `.agent/Tasks/Implementation/2026-07-13-agent-first-fixes-and-roadmap.md` (Phases 2–3 still pending there)

## Work done

### Migrations (need `npx supabase db push` — could not be applied from the remote session; no link credentials)
- `20260713010000_updated_at_triggers.sql` — `updated_at` now bumps on every UPDATE of every wpa table (REST PATCHes included), making change polling reliable.
- `20260713010100_unify_pipeline_sync.sql` — `lifecycle_stage` is authoritative; a BEFORE INSERT/UPDATE trigger keeps legacy `contact_status` mirrored both ways; one-time backfill fixes rows stuck at the old bulk default; new-row default is now `identified`.
- `20260713010200_agent_surface.sql` — `wpa_tasks.assigned_to` ('human'|'bob', backfilled from the `bobwork` tag), `review` added to the status CHECK, new append-only `wpa_task_events` table, `wpa_activity.actor` column (+ backfill of agent-authored stage moves).
- `20260713010300_rpc_actor_params.sql` — `append_activity`, `move_to_stage`, `convert_to_client` recreated with trailing `p_actor TEXT DEFAULT 'bob'` (drop+create to avoid PostgREST overload ambiguity). Existing Bob calls keep working.

### Frontend fixes
- `use-businesses.ts`: all business mutations now invalidate the full key set (businesses + discovery-recent/search/stats) via a shared helper; dead `['discovery']` keys removed. Fixes stale Discovery lists/stat tiles after status changes, conversions, deletes.
- `use-tasks.ts`: `useTasks` excludes templates (fixes ghost tasks on the board and inflated ClientBoard counts); template generation now copies `tags`/`assigned_to`.
- `TasksPage.tsx`: template generation is an explicit "Generate recurring" button instead of a DB write on every page visit.

### Agent surface UI
- TaskForm: "Assign to" Me/Bob control (dual-writes the `bobwork` tag during skill transition, removes it when reassigned to Me), `review` status option, and an Activity section (append-only comments + Bob's run log from `wpa_task_events`).
- TaskBoard/TaskColumn/TaskCard: new Review column (5-col board), All/Mine/Bob assignee filter, Bob badge on assigned cards.
- Discovery page: "Bud" renamed to Bob.

### Docs / protocol
- `CONTEXT.md` rewritten to match reality (8-stage lifecycle, actor params, task statuses, Bob identity).
- `.agent/README.md` agent protocol updated (assigned_to queue, task events, review status; legacy protocol noted as transitional).
- New `.agent/System/bob-task-protocol.md` — the v2 contract to implement in Bob's VPS skill file.
- New `.agent/Knowledge/agent-first-architecture.md` — decisions + known debt.
- Added missing `.env.example`.

### Phase 1.5 prepared (execution needs owner's Supabase account — runbook: `.agent/Tasks/Implementation/2026-07-13-new-supabase-cutover.md`)
- `supabase/new-project/lockdown_policies.sql` — authenticated-only policies, anon fully revoked.
- `src/components/auth/AuthGate.tsx` + App.tsx wiring — login gate behind `VITE_REQUIRE_AUTH=true` (inert until cutover).

## Verification
- `npm run build` clean (tsc + vite).
- `npm run lint`: 28 pre-existing problems, identical count before/after — zero new issues introduced.
- Migrations not yet applied (no Supabase credentials in the remote session). After `db push`, run the verification queries in the migration comments and the checks in the plan's "Phase 1 verification" section.

## Owner follow-ups
1. `npx supabase@latest link --project-ref klyzdnocgrvassppripi && npx supabase@latest db push`
2. Update Bob's skill file per `.agent/System/bob-task-protocol.md` (old protocol keeps working meanwhile).
3. When ready, execute the Phase-1.5 cutover runbook.
