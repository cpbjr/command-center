# Command Center — Phase 2 Consolidation (Steps 1–4)

**Branch:** `claude/phase-2-consolidation`
**Scope:** Safe, pure-refactor tier of Phase 2 from the [agent-first roadmap](2026-07-13-agent-first-fixes-and-roadmap.md). No schema/data changes. Steps 5–6 (drop `contact_status`, restore FKs) deferred to a follow-up that needs Bob's VPS skill cutover confirmed + live-data validation.

## Design decisions (grilled against current `main`, 2026-07-14)

- **Types freshness:** commit `src/lib/database.types.ts` + add `npm run db:types` regen script; document "regen after migrations". No build-time network dependency.
- **Query-key factory:** full migration — factory covers all keys, every string-literal `queryKey` replaced in one pass, invalidation helper becomes structural.
- **Score dedup — OVERRIDE roadmap:** `ScoreBar` and `ScoreBadge` are visually distinct primitives sharing only score→color thresholds. Extract shared `scoreColor` helper into `src/lib/score.ts`; keep both components. Do NOT merge into `ScoreIndicator`.
- **TaskList dedup:** merge `LeadTaskList` + `ClientTaskList` → `EntityTaskList`, preserving the `clientId == contractId` 1:1 fallback exactly (that assumption is step 6's job to fix, out of scope here).

## Tasks

### Step 1 — Generated types (foundation; do first)
- [ ] `npm run db:types` script in package.json → `supabase gen types typescript --linked --schema wpa > src/lib/database.types.ts`
- [ ] Generate & commit `src/lib/database.types.ts`
- [ ] `createClient<Database>` in `src/lib/supabase.ts`
- [ ] Derive row types from `Database['wpa']['Tables'][...]` where hooks hand-declare them
- [ ] Remove 8 `as any` casts (ProjectCard ×2, ProjectDetail ×2, TaskCard ×2, TasksPage ×1, TaskForm ×1) + hand-redeclared join shapes in use-tasks/use-projects/use-contracts
  - Verify: `npm run build` clean, `grep -rn "as any" src/` = 0 (or only genuinely-needed)

### Step 2 — Query-key factory
- [ ] `src/lib/query-keys.ts` — factory for businesses, discovery-recent/search/stats, tasks, task-events, projects, project-updates, contracts, clients, businesses-simple, etc.
- [ ] Replace all string-literal `queryKey` arrays across hooks
- [ ] Rewrite `invalidateBusinessCaches` to use the factory
  - Verify: `npm run build` clean; grep for stray string-literal query keys

### Step 3 — Dedup
- [ ] `src/lib/score.ts` — `scoreColor(score)` threshold helper; ScoreBar + ScoreBadge consume it
- [ ] Merge LeadTaskList + ClientTaskList → `EntityTaskList` (preserve contractId fallback); update LeadDetail + ClientForm imports
- [ ] `DiscoveryBusiness` type → generated Business row (or Pick of it)
- [ ] Hoist `PRIORITY_ORDER` → `src/lib/constants.ts`
  - Verify: build clean, affected screens render

### Step 4 — Over-fetching
- [ ] DiscoveryPage: single query (drop duplicate empty-search fetch)
- [ ] `useBusinessesSimple`: server-side `ilike` + `limit(20)` search instead of paging ~1900 rows
- [ ] ClientBoard: count query instead of fetching all tasks
  - Verify: dev server smoke test — combobox search works, client counts correct

### Bonus — pre-existing Discovery bug (flagged in handoff)
- [ ] `useDiscoveryStats` selects `wpa_businesses_with_score.last_audited_at` which the view no longer has → drop the stale ref, fix the two console 400s
  - Verify: Discovery page loads with zero console 400s

## Verification (whole PR)
1. `npm run build` + `npm run lint` clean (lint warning count unchanged)
2. `npm run dev` smoke: Discovery (no 400s, search/stats refresh), Leads/Clients task lists render, business combobox search, client task counts
3. `/verify` on affected flows before PR

## Completion
Move this doc to `.agent/Tasks/Completed/2026-07/` with a work log when done.

---

## Work Log — completed 2026-07-14

All four steps + the bonus landed as one PR on `claude/phase-2-consolidation`. Build clean, lint reduced 28→20 problems (removed 8 `as any`), verified end-to-end in a headless browser.

### Step 1 — Generated types
- Added `db:types` npm script; committed `src/lib/database.types.ts` (schema `wpa`).
- `createClient<Database, 'wpa'>` in `src/lib/supabase.ts`.
- Derived row types from the generated tables in `use-tasks`, `use-projects`, `use-contracts`, `use-contacts`, `use-gbp-analytics` — **kept the domain enum unions** (`TaskStatus`, etc.) and join relations by `Omit`-and-override, so no type precision was lost.
- Removed all 8 `as any` casts.
- **The typed client surfaced 3 real latent bugs** (fixed): `GbpAnalytics.id` was `number` but the column is a uuid (string); `Contact.business_id` was `string | null` but the column is `NOT NULL` (insert path could send null — now guarded in `ContactForm`); and the Discovery 400 (see Bonus).

### Step 2 — Query-key factory
- New `src/lib/query-keys.ts` covers every key; all 16 hooks migrated off string literals.
- `invalidateBusinessCaches` now iterates `businessCacheRoots` from the factory.

### Step 3 — Dedup
- `src/lib/score.ts` `scoreTier()` — ScoreBar and ScoreBadge both consume it (kept separate per the roadmap override; each maps tier→its own class set).
- `LeadTaskList` + `ClientTaskList` → `src/components/tasks/EntityTaskList.tsx`; the `businessId ? undefined : contractId` fallback preserved exactly (step-6 territory). Old files deleted; `LeadDetail` + `ClientForm` updated.
- `DiscoveryBusiness` is now the generated `wpa_businesses_with_score` view row.
- `PRIORITY_ORDER` hoisted to `src/lib/constants.ts` (removed from both hooks).

### Step 4 — Over-fetching
- DiscoveryPage: single `useDiscoverySearch` serves both modes; removed the now-dead `useRecentDiscoveries` hook.
- `useBusinessesSimple(search)`: server-side `ilike` + `limit(20)` (was a `while(true)` loop paging ~1900 rows). TaskForm debounces the search (300ms) and tracks `selectedLeadName` so the trigger label survives a search that no longer contains the selection.
- ClientBoard: new `useOpenTaskCountsByContract` selects only `contract_id` for open contract-linked tasks (was fetching every task with joins).

### Bonus
- `useDiscoveryStats` filtered on `last_audited_at` (dropped from the view 2026-03-15) → the 400s. Now filters on `latest_score`. Also removed the dead "Audited" table column that always rendered `—`.

### Verification (headless Chrome, dev server)
- Discovery: stats load, requests use `latest_score` not `last_audited_at`, 0 console 400s, single recent query.
- Clients: fires the `select=contract_id` count query, not a full task fetch.
- TaskForm lead combobox: typing fires `wpa_businesses?select=id,name&limit=20&name=ilike.%…%`; probe confirmed selected-lead label persists across a non-matching search.
- `npm run build` clean; `npm run lint` 20 problems (baseline 28), 0 introduced.

### Deferred (separate follow-up)
Steps 5–6 (drop `contact_status` + sync trigger; restore FKs / rename `client_id`→`contract_id`). Both touch live data; step 5 needs Bob's VPS skill cutover confirmed. The `clientId == contractId` 1:1 fallback in `EntityTaskList` is step 6's job — left intact.
