# Command Center — Agent-First Ops Hub: Fixes + Phased Roadmap

## Context

Command Center was cobbled together from two systems — a discovery/leads pipeline and a tasks/projects/clients tracker — and it shows: duplicated types and components, two conflicting pipeline fields, three activity systems, and an agent protocol that's just a magic `bobwork` tag. The owner's decisions (from clarification):

- **End target: agent-first ops hub.** The Supabase DB is the source of truth and the API between owner, UI, and the agent; the UI is a clean review/steer surface.
- **One agent going forward:** a Hermes-based agent the owner calls **Bob** (Robert). OpenClaw/OC Bob is retired; the "Bud" naming on Discovery gets cleaned up. Use `'bob'` as the actor/assignee identifier.
- **Routing: blend of explicit → autonomous.** Start with explicit assignment + full audit trail; grow toward "agent proposes / standing rules."
- **CRM features wanted (all, phased):** follow-ups & reminders, pipeline + deal stages, interaction/activity log, email integration (email deferred — agent will capture owner's whitepineagency.com mail and draft its own, later).
- **Scope: phased.** Phase 1 = high-impact fixes + agent surface now; consolidation and CRM features as follow-on phases.

Verified review findings driving this plan:
1. **Broken cache invalidation** — `useUpdateBusinessStatus` (`src/hooks/use-businesses.ts:147-168`) invalidates only `['businesses']`; Discovery reads `['discovery-recent']`, `['discovery-search']`, `['discovery-stats']` (`src/hooks/use-discovery.ts`). `useConvertToClient` misses discovery keys; dead `['discovery']` key at lines 185/206; `discovery-stats` never invalidated.
2. **Template tasks leak** — `useTasks` (`src/hooks/use-tasks.ts:57-90`) doesn't filter `is_template` (unlike `use-projects.ts:189`); templates render on the board and inflate ClientBoard counts. `TasksPage.tsx:16-18` also fires a DB write (`generateTemplates.mutate()`) on every mount.
3. **Two conflicting pipeline fields** on `wpa_businesses`: legacy `contact_status` (what the UI reads/writes) vs `lifecycle_stage` enum (what the agent writes via `move_to_stage` RPC). They silently diverge — biggest data-model liability.
4. **No `updated_at` triggers anywhere** — agent REST PATCHes never bump `updated_at`, so change-polling is unreliable.
5. **Security**: RLS policies are all `USING(true)`, `GRANT ALL` to anon, no auth in the app — the anon key in the public bundle is full DB write access.
6. Agent surface is just the `bobwork` tag (free-text input), notes get overwritten on completion, no actor attribution on `wpa_activity` (CONTEXT.md documents an `actor` param that doesn't exist in the RPC).

---

## Phase 1 — High-impact fixes + agent surface (THIS session)

### Migrations (in `supabase/migrations/`)

**`20260713010000_updated_at_triggers.sql`**
- `wpa.set_updated_at()` trigger function; loop over `information_schema.columns` to attach `BEFORE UPDATE` trigger to every `wpa` table with an `updated_at` column (`wpa_businesses`, `wpa_tasks`, `wpa_projects`, `wpa_contacts`, `wpa_contracts`).

**`20260713010100_unify_pipeline_sync.sql`**
- `lifecycle_stage` becomes authoritative; `contact_status` becomes a synced legacy mirror (dropped in Phase 2).
- `wpa.sync_pipeline_fields()` BEFORE UPDATE trigger: whichever field changed updates the other. Mapping: IDENTIFIED↔identified, NEW↔new, TARGETED↔prospect, CONTACTED↔qualified, REPLIED→qualified, CLOSED↔churned, CLOSED-WON↔client; reverse: proposal→REPLIED, lead→REPLIED.
- One-time backfill: rows still at the bulk default `lifecycle_stage='lead'` without a contract get remapped from `contact_status`; deliberately-set rows trust `lifecycle_stage`.

**`20260713010200_agent_surface.sql`**
- `wpa_tasks.assigned_to TEXT NOT NULL DEFAULT 'human' CHECK (assigned_to IN ('human','bob'))` + partial index on open tasks; backfill `assigned_to='bob'` where `tags @> '{bobwork}'`.
- Add `'review'` to the `wpa_tasks.status` CHECK (todo / in_progress / blocked / review / done) — agent finishes into `review`, owner closes to `done`.
- New append-only `wpa.wpa_task_events` table: `(id, task_id FK CASCADE, actor TEXT DEFAULT 'human', kind CHECK (comment|status_change|assignment|agent_run), body TEXT, meta JSONB, created_at)` + index `(task_id, created_at)`. Replaces the agent overwriting `notes`. Grants/RLS matching current posture (tightened in the security phase).
- `wpa_activity.actor TEXT NOT NULL DEFAULT 'human'`.

**`20260713010300_rpc_actor_params.sql`**
- `DROP FUNCTION` + recreate `wpa.append_activity` with trailing `p_actor TEXT DEFAULT 'bob'` (drop-then-create, not CREATE OR REPLACE — an overload would make PostgREST RPC calls ambiguous). Same for `move_to_stage` (stamp actor on its `stage_change` activity insert). Existing agent calls without the param keep working. Fixes the CONTEXT.md drift.

### Frontend fixes

- **`src/hooks/use-businesses.ts`**: shared `invalidateBusinessCaches(qc)` helper invalidating `['businesses']`, `['discovery-recent']`, `['discovery-search']`, `['discovery-stats']`; use it in `useUpdateBusinessStatus`, `useConvertToClient`, `useUpdateBusinessNotes`, `useUpdateBusinessFolderPath`; delete the dead `['discovery']` keys.
- **`src/hooks/use-tasks.ts`**: add `.eq('is_template', false)` to `useTasks`; add `assigned_to: 'human' | 'bob'` to `Task`/`TaskInsert`.
- **`src/pages/TasksPage.tsx`**: replace fire-on-every-mount `generateTemplates.mutate()` with an explicit "Generate recurring" button (predictable, auditable).

### Agent surface UI

- **`src/components/tasks/TaskForm.tsx`**: "Assign to" segmented control (Me / Bob) → `assigned_to`; while assigned to Bob, also append `bobwork` tag during the transition window.
- **`TaskCard.tsx` / `TaskBoard.tsx` / `TaskColumn.tsx`**: bot badge for Bob's tasks; new `review` column; assignee filter chips (All / Mine / Bob).
- **New `src/hooks/use-task-events.ts`**: `useTaskEvents(taskId)` (key `['task-events', taskId]`) + `useAddTaskEvent`; render the event timeline (and a comment box) in the task edit sheet.
- Rename "Bud" references on `DiscoveryPage.tsx` to Bob.

### Docs + agent cutover (documented in the repo for the owner to apply on the VPS)

- Update `CONTEXT.md` (RPC signatures now real) and `.agent/README.md` (stale table names; new protocol). Create `.agent/Knowledge/` (mandated by CLAUDE.md, missing).
- Bob's skill file on the VPS (`/home/wpauser/.hermes/...`, not in repo) changes, listed in the docs:
  1. Queue query → `GET /rest/v1/wpa_tasks?assigned_to=eq.bob&status=in.(todo,in_progress,blocked)` (old bobwork query keeps working during transition).
  2. On completion → `PATCH {status:'review'}` + `POST wpa_task_events {actor:'bob', kind:'agent_run', body:'<what was done>'}` instead of overwriting notes.
  3. Optionally pass `p_actor:'bob'` (it's the default).
- Add missing `.env.example` (README instructs `cp .env.example .env` but the file doesn't exist).
- Save this plan to `.agent/Tasks/Implementation/` per CLAUDE.md; move to `completed/` with a work log when done.

### Phase 1 verification

1. `npm run build` + `npm run lint` clean.
2. Migrations apply cleanly (`npx supabase db push` — or note for owner if link creds unavailable in this environment). Phase 1 migrations still land against the current project so Bob keeps running; they're folded into the Phase-1.5 baseline for the new project.
3. REST PATCH a task → `updated_at` bumps. UI status change → `lifecycle_stage` follows; `move_to_stage` → `contact_status` follows; `GROUP BY contact_status, lifecycle_stage` shows no off-mapping pairs.
4. `assigned_to='bob'` count equals prior `tags @> '{bobwork}'` count.
5. UI (via `npm run dev`): no templates on the board, ClientBoard counts drop, Discovery list/stats refresh immediately after status change/convert, Bob filter + review column work.

---

## Phase 1.5 — New dedicated WPA Supabase project + security lockdown (owner-requested; one sitting)

The current project is shared with other apps (`turfsheet`, `crm`, `taskboard` schemas, `public.jobs`/`staff`), so the god-mode anon key exposes them all. Moving WPA to its own project is low-risk — verified: frontend uses only env vars (no hardcoded ref), no storage buckets, no edge functions, no auth users, small data (~2,100 businesses + related rows).

**Decision: keep table names identical (`wpa` schema, `wpa_*` tables)** so the cutover requires zero code changes in the app or Bob's skill. The `wpa.wpa_*` double-prefix cleanup stays an optional later cosmetic pass.

Prepared in this repo (this session can do all of it):
1. **Squashed baseline migration** — one clean `..._baseline.sql` representing the post-Phase-1 schema (tables, view, enums, RPCs, triggers, indexes, grants), replacing the 58-file replay for the new project. Old migrations archived, not deleted from git history.
2. **Locked-down policies from day one**: all `wpa` policies `TO authenticated`; no `GRANT ... TO anon`. `LoginPage` + session guard in `src/App.tsx` (~60 lines); Supabase JS sends the JWT automatically, no query-code changes.
3. **Cutover runbook** (`.agent/Tasks/Implementation/`): create project → `npx supabase link` + `db push` baseline → `pg_dump --schema=wpa` from old / restore to new → create the single auth user → update the four credential locations: GitHub Actions secrets (`VITE_SUPABASE_URL`/`ANON_KEY`), local `.env`, Bob's skill config on the VPS (switches to the **service-role key**, which bypasses RLS — REST/RPC calls otherwise unchanged), and the MCP config (`white-pine-projects`). Then verify Bob's queue query + RPCs against the new project, redeploy dashboard, and finally drop the `wpa` schema from the old shared project.

Executed by the owner (or a session with Supabase account access) since it needs project creation + secrets. Bob is cut over first so nothing breaks mid-move.

---

## Phase 2 — Consolidation (follow-on)

Order: types first, everything else gets cheaper.
1. **Generated Supabase types**: `supabase gen types typescript --schema wpa > src/lib/database.types.ts`; `createClient<Database>` in `src/lib/supabase.ts`; derive row types, delete ~9 `as any` casts and the join shape hand-redeclared in `use-tasks.ts:27-28`, `use-projects.ts:31`, `use-contracts.ts:28`.
2. **Query-key factory** `src/lib/query-keys.ts`; replaces string keys and makes the Phase-1 invalidation helper structural.
3. **Dedupe**: `DiscoveryBusiness` → generated Business row; merge `ScoreBar`/`ScoreBadge` → `shared/ScoreIndicator`; merge `LeadTaskList`/`ClientTaskList` → `EntityTaskList`; hoist duplicated `PRIORITY_ORDER` to `src/lib/constants.ts`.
4. **Over-fetching**: DiscoveryPage single query (drop the duplicate empty-search fetch); `useBusinessesSimple` → server-side `ilike` + `limit(20)` combobox search instead of paging ~1900 rows; ClientBoard → count query instead of fetching all tasks.
5. **Finish pipeline migration**: UI switches to `lifecycle_stage` (status mutation → `move_to_stage` RPC, free activity logging); then drop `contact_status` + sync trigger once Bob's skill confirmed clean.
6. **Restore FKs**: rename bare `client_id` → `contract_id` on `wpa_client_baselines`/`wpa_gbp_scores`/`gbp_analytics`/`wpa_gbp_insights` with real FKs to `wpa_contracts` (validate with anti-join first); fix the hardcoded id==id assumption in `ClientTaskList.tsx:14-20`, `ClientForm.tsx:242-246`.

## Phase 3 — CRM features (each independently shippable)

1. **Follow-ups / Today view** (highest value): `next_action_date DATE` + `next_action TEXT` on `wpa_businesses` (works pre- and post-conversion; migrate `wpa_contracts.next_action` free text). New Today page at `/`: overdue + due-today tasks, businesses with `next_action_date <= today`, tasks in `review` (Bob's inbox), latest Bob activity. This is the agent-first steering surface in one screen.
2. **Deal fields**: `est_monthly_value NUMERIC`, `expected_close_date DATE` on `wpa_businesses` (no separate deals table for a solo one-pipeline agency); pipeline-value sum on LeadsPage; `convert_to_client` copies est value into the contract.
3. **Contact-linked activity**: `wpa_activity.contact_id FK`; contact picker in the activity logger; fold `wpa_contact_notes` into `wpa_activity(type='note')` — cures notes fragmentation.
4. **Email (deferred, agent-mediated)**: Bob (already tied into the whitepineagency.com mailbox) periodically logs threads matching known contacts via `append_activity(type='email', actor='bob', contact_id, summary)`, and drafts outbound emails as proposals. No frontend email infrastructure — the activity feed renders it.
5. **Autonomy ramp — "agent proposes / standing rules"**: `wpa_agent_rules(name, trigger_desc, instruction, enabled, last_fired_at)` — natural-language rules interpreted by Bob each run, toggleable in a small AgentRulesPage; add `'proposed'` status + `origin ('human'|'bob'|'rule')` to `wpa_tasks`; Today view gets an approve/reject inbox (approve → todo, reject → delete + task_event). Rules start disabled and are enabled one at a time as trust builds — the explicit→autonomous blend the owner asked for.

---

## Notes

- Every Phase-1 schema change is backward-compatible with the live agent skill; cutover steps are additive and listed above.
- Critical files: `src/hooks/use-businesses.ts`, `src/hooks/use-tasks.ts`, `src/pages/TasksPage.tsx`, `src/components/tasks/TaskForm.tsx`, `src/components/tasks/TaskBoard.tsx`, `supabase/migrations/` (pattern reference: `20260619222141_rpc_append_activity.sql`, `20260621022252_expand_lifecycle_stages.sql`), `CONTEXT.md`, `.agent/README.md`.
- Work happens on branch `claude/code-review-hermes-optimization-qxyg6e`; commit and push there.
