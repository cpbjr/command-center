> ## ✅ COMPLETED 2026-07-14
>
> All tasks shipped on branch `claude/phase-2-steps-5-6`. Work log:
>
> **Step 6 (FK restore):** Tasks 6.1–6.5 done. Corrected the plan's 6-table list to **5** — `wpa_client_activity` was already dropped in `20260620044614`. Deleted orphan `client_id=3` ("A Dog Zen Salon"), renamed `client_id → contract_id` + real FKs to `wpa_contracts` on 5 tables; renamed `clientId → contractId` through hooks/query-keys/widgets. Build green.
>
> **Step 5 additive (5.1–5.8):** Added `dropped_reason`, contract `close_reason`/`closed_at`, `dropped` enum value, `end_engagement` RPC. New `src/lib/lifecycle.ts`; RPC-based `useMoveToStage`/`useMarkDropped`/`useEndEngagement`; StatusBadge/LeadCard/LeadTable/LeadDetail/Discovery rewired to `lifecycle_stage` with `actor='human'`; deleted `useUpdateBusinessStatus`. Also caught + fixed a latent bug: `wpa_businesses_with_score` view (the app's data source) froze its column list at CREATE time and had to be recreated to expose the new columns (`20260714214101`).
>
> **Step 5 gated (5.9+5.10):** Ran after Bob's VPS skill was cut over to protocol v2 (confirmed via `2026-07-14-cc-protocol-schema-drift.md`). **Merged into one migration** (`20260714040000`) because the sync trigger's mapping fn takes `lifecycle_stage` as a param type, blocking `DROP TYPE` until the trigger + column were gone first. Remapped 1904 rows (new/prospect→new_prospect, qualified/proposal/lead→lead, churned→relationship_ended) with none lost; rebuilt enum to the final 6 values; dropped `contact_status`. Dropped 3 views that read `contact_status`: recreated `wpa_businesses_with_score` without it; **dropped** untracked legacy `public.businesses_with_crm_status` + `public.businesses_with_score` (public-schema debris). Pre-remap snapshot in `artifacts/2026-07-14-lifecycle-stage-pre-remap-snapshot.json`.
>
> **Also updated:** `.agent/System/bob-task-protocol.md` (+ Obsidian copy) to the final vocabulary + `end_engagement`; `CONTEXT.md` (removed planned-migration notes).
>
> **Follow-ups (not done here):** (1) full `public`-schema cleanup — ~10 leftover legacy tables remain, raised separately with owner; (2) remove `bobwork` dual-write in `TaskForm.tsx` once Bob is fully off the tag.
>
> ---

# Phase 2 Steps 5–6: Finish Pipeline Migration + Restore FKs — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the Leads UI off the legacy `contact_status` field onto a refined `lifecycle_stage` pipeline (Identified → New Prospect → Lead → Client, plus Dropped and Relationship Ended terminals), and restore real foreign keys on the GBP/baseline tables by cleaning orphaned `client_id` data and renaming it to `contract_id`.

**Architecture:** Two independent tracks. **Step 5** is a DB enum refactor + new reason fields + a new RPC, then a UI rewrite so every stage change goes through an RPC (`move_to_stage` / `convert_to_client` / `end_engagement`) with `actor='human'` for a full audit trail; the legacy `contact_status` column + sync trigger are dropped **only after Bob's skill is confirmed off it** (owner-gated). **Step 6** deletes the orphaned `client_id=3` rows (an erroneously-created client, since removed) across six tables, then renames `client_id → contract_id` with real FKs to `wpa_contracts`; the code side is a pure `clientId → contractId` prop/param rename because the values are already contract ids.

**Tech Stack:** React 18 + TypeScript, Vite, TanStack Query, shadcn/ui, Supabase (PostgreSQL, schema `wpa`, project ref `klyzdnocgrvassppripi`). Migrations via `npx supabase db push`. Live queries via MCP-as-code / PostgREST. **No unit-test runner exists** — verification is `npm run build` (runs `tsc -b`), `npm run lint`, live SQL checks, and dev-server smoke tests.

---

## Ground Truth (verified 2026-07-14 against live DB + code)

- **Phase 1 is live** on `klyzdnocgrvassppripi`: `lifecycle_stage`, `updated_at`, and the 3-arg RPCs (`move_to_stage`/`convert_to_client`/`append_activity` with trailing `p_actor TEXT DEFAULT 'bob'`) all exist. The app still points at this shared project (Phase 1.5 cutover not done).
- **Current live enum** `wpa.lifecycle_stage` = `identified, new, prospect, qualified, proposal, lead, client, churned`. All 2,100 businesses are at `identified`.
- **Step 6 premise was false.** Only two contracts exist (`wpa_contracts.id` = 1, 2). The GBP/baseline tables carry `client_id = 3`, an id from the **dropped** `wpa_clients` table — no matching contract. It was "Infinity Home Audio" (or similar), a business wrongly added as a client, since removed. Genuinely dead data.
- **`client` in `ClientForm` is a `Contract` row** — so `client.id` already IS the contract id. The `clientId` props are a misnomer, not a data bug.

## Refined Pipeline Vocabulary (decided in grill; recorded in `CONTEXT.md`)

Target `lifecycle_stage` enum:

| Value | UI Label | Meaning | How reached |
|---|---|---|---|
| `identified` | Identified | Bob discovered it, unreviewed | Bob (discovery) |
| `new_prospect` | New Prospect | Reviewed, actively pursuing | dropdown |
| `lead` | Lead | Hot, engaged, pre-signature | dropdown |
| `client` | Client | Active client | Convert to Client (writes contract) |
| `dropped` | Dropped | A **lead** that ended before becoming a client; revivable | dropdown / action + optional reason |
| `relationship_ended` | Relationship Ended | A **former client**; engagement over | End Engagement action + reason |

**Remap:** `new + prospect → new_prospect`; `qualified + proposal + lead → lead`; `churned → relationship_ended`; add `dropped`.
**Reasons:** `wpa_businesses.dropped_reason` (`declined | not_a_fit | no_response`, nullable); `wpa_contracts.close_reason` (`work_completed | parted_ways`, nullable) + `closed_at TIMESTAMPTZ`.
**Cutover:** Hard enum cutover — Bob's skill must write the new values before the enum swap runs. All UI writes go through RPCs with `actor='human'`.

## Execution Ordering & Gates

1. **Step 6 first** (Tasks 6.x) — fully independent of the pipeline work, lower risk, no Bob dependency. Ship it, then Step 5.
2. **Step 5 DB + UI** (Tasks 5.x) — everything except the `contact_status` drop.
3. **GATE — owner/ops:** confirm Bob's VPS skill writes the new `lifecycle_stage` values (not `contact_status`, not old enum values) **before** running Task 5.9 (enum swap) and Task 5.10 (drop `contact_status`). Do not run 5.9–5.10 until the owner confirms.

Branch: create a fresh feature branch off `main` (e.g. `claude/phase-2-steps-5-6`). Commit after every task. **Do not run migrations without owner sign-off on the gate for 5.9–5.10.**

---

# STEP 6 — Restore FKs (do this track first)

### Task 6.1: Snapshot the orphan data before deleting

**Files:**
- Create: `.agent/Tasks/Implementation/artifacts/2026-07-14-client_id-3-snapshot.json` (evidence of what was deleted)

**Step 1: Capture every `client_id=3` row across the six tables**

Run (from `~/WhitePineTech/Projects/CommandCenter`, sourcing `.env` for the anon key):

```bash
source .env
KEY="$VITE_SUPABASE_ANON_KEY"; URL="$VITE_SUPABASE_URL"
H=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: wpa")
mkdir -p .agent/Tasks/Implementation/artifacts
for t in wpa_client_baselines wpa_gbp_scores gbp_analytics wpa_gbp_insights wpa_weekly_reports wpa_client_activity; do
  echo "=== $t ==="
  curl -s "$URL/rest/v1/$t?select=*&client_id=eq.3" "${H[@]}"
  echo ""
done | tee .agent/Tasks/Implementation/artifacts/2026-07-14-client_id-3-snapshot.json
```

Expected counts (from the grill): baselines 1, gbp_scores 1, gbp_analytics 0, gbp_insights 6, weekly_reports 8, client_activity (small). Confirm the snapshot is non-empty for the tables above.

**Step 2: Commit the snapshot**

```bash
git add .agent/Tasks/Implementation/artifacts/2026-07-14-client_id-3-snapshot.json
git commit -m "chore(step-6): snapshot orphaned client_id=3 rows before deletion"
```

---

### Task 6.2: Migration — delete orphans, rename to contract_id, add FKs

**Files:**
- Create: `supabase/migrations/20260714010000_gbp_contract_id_fk.sql`

**Step 1: Write the migration**

Six tables carry legacy `client_id`. Delete the orphan `client_id=3` rows, rename the column, and add a real FK to `wpa_contracts`. Note `wpa_client_activity` has no rows for id 3 (already checked) but still carries the column — treat it identically for schema consistency.

```sql
-- Migration: restore FKs on GBP/baseline tables (Phase 2 Step 6)
-- Date: 2026-07-14
-- Context: client_id on these tables is legacy data from the dropped wpa_clients
--   table, NOT a contract id. Only contracts 1,2 exist; client_id=3 is an orphan
--   ("Infinity Home Audio", a business wrongly added as a client, since removed).
--   We delete the orphan rows, rename client_id -> contract_id, and add a real FK.
-- Rollback: drop the FK + rename contract_id back to client_id per table; deleted
--   rows are recoverable from artifacts/2026-07-14-client_id-3-snapshot.json.
-- Validation: the anti-join at the end MUST return zero rows before the FK is added.

BEGIN;

-- 1) Delete orphaned rows (client_id with no matching contract). We target =3
--    explicitly (the known orphan) rather than a blind anti-join delete, so the
--    delete is auditable against the snapshot.
DELETE FROM wpa.wpa_client_baselines WHERE client_id = 3;
DELETE FROM wpa.wpa_gbp_scores        WHERE client_id = 3;
DELETE FROM wpa.gbp_analytics         WHERE client_id = 3;
DELETE FROM wpa.wpa_gbp_insights      WHERE client_id = 3;
DELETE FROM wpa.wpa_weekly_reports    WHERE client_id = 3;
DELETE FROM wpa.wpa_client_activity   WHERE client_id = 3;

-- 2) Anti-join guard: fail loudly if ANY orphan remains in ANY table.
DO $$
DECLARE
  v_orphans INT;
BEGIN
  SELECT
    (SELECT count(*) FROM wpa.wpa_client_baselines b LEFT JOIN wpa.wpa_contracts c ON b.client_id = c.id WHERE c.id IS NULL) +
    (SELECT count(*) FROM wpa.wpa_gbp_scores        b LEFT JOIN wpa.wpa_contracts c ON b.client_id = c.id WHERE c.id IS NULL) +
    (SELECT count(*) FROM wpa.gbp_analytics         b LEFT JOIN wpa.wpa_contracts c ON b.client_id = c.id WHERE c.id IS NULL) +
    (SELECT count(*) FROM wpa.wpa_gbp_insights      b LEFT JOIN wpa.wpa_contracts c ON b.client_id = c.id WHERE c.id IS NULL) +
    (SELECT count(*) FROM wpa.wpa_weekly_reports    b LEFT JOIN wpa.wpa_contracts c ON b.client_id = c.id WHERE c.id IS NULL) +
    (SELECT count(*) FROM wpa.wpa_client_activity   b LEFT JOIN wpa.wpa_contracts c ON b.client_id = c.id WHERE c.id IS NULL)
  INTO v_orphans;
  IF v_orphans > 0 THEN
    RAISE EXCEPTION 'Aborting: % orphaned client_id rows remain after delete', v_orphans;
  END IF;
END $$;

-- 3) Rename client_id -> contract_id and add a real FK per table.
ALTER TABLE wpa.wpa_client_baselines RENAME COLUMN client_id TO contract_id;
ALTER TABLE wpa.wpa_client_baselines
  ADD CONSTRAINT wpa_client_baselines_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES wpa.wpa_contracts(id);

ALTER TABLE wpa.wpa_gbp_scores RENAME COLUMN client_id TO contract_id;
ALTER TABLE wpa.wpa_gbp_scores
  ADD CONSTRAINT wpa_gbp_scores_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES wpa.wpa_contracts(id);

ALTER TABLE wpa.gbp_analytics RENAME COLUMN client_id TO contract_id;
ALTER TABLE wpa.gbp_analytics
  ADD CONSTRAINT gbp_analytics_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES wpa.wpa_contracts(id);

ALTER TABLE wpa.wpa_gbp_insights RENAME COLUMN client_id TO contract_id;
ALTER TABLE wpa.wpa_gbp_insights
  ADD CONSTRAINT wpa_gbp_insights_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES wpa.wpa_contracts(id);

ALTER TABLE wpa.wpa_weekly_reports RENAME COLUMN client_id TO contract_id;
ALTER TABLE wpa.wpa_weekly_reports
  ADD CONSTRAINT wpa_weekly_reports_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES wpa.wpa_contracts(id);

ALTER TABLE wpa.wpa_client_activity RENAME COLUMN client_id TO contract_id;
ALTER TABLE wpa.wpa_client_activity
  ADD CONSTRAINT wpa_client_activity_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES wpa.wpa_contracts(id);

COMMIT;
```

> **NOTE on `gbp_insights` upsert:** `use-gbp-insights.ts` upserts with `onConflict: 'client_id,week_ending'`, which implies a unique constraint/index named on `client_id`. Renaming the column auto-updates the index definition, but **verify** in Step 3 that a `(contract_id, week_ending)` unique constraint still exists; if the old constraint was named with `client_id`, PostgREST `onConflict` in Task 6.4 must use `contract_id,week_ending`.

**Step 2: Push the migration**

```bash
export SUPABASE_ACCESS_TOKEN="<from project CLAUDE.md / owner>"
npx supabase@latest link --project-ref klyzdnocgrvassppripi
npx supabase@latest db push
```
Expected: applies cleanly. If the anti-join `RAISE EXCEPTION` fires, STOP — there is an orphan other than id 3; investigate before proceeding.

**Step 3: Verify the schema change live**

```bash
source .env; KEY="$VITE_SUPABASE_ANON_KEY"; URL="$VITE_SUPABASE_URL"
H=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: wpa")
# contract_id now exists; client_id is gone
curl -s "$URL/rest/v1/wpa_gbp_insights?select=contract_id&limit=3" "${H[@]}"
# unique constraint check for the insights upsert
curl -s "$URL/rest/v1/wpa_gbp_scores?select=contract_id&limit=3" "${H[@]}"
```
Expected: rows return `contract_id`; requesting `client_id` now errors (column gone).

**Step 4: Commit**

```bash
git add supabase/migrations/20260714010000_gbp_contract_id_fk.sql
git commit -m "feat(step-6): delete orphan client_id, rename to contract_id + FK on 6 tables"
```

---

### Task 6.3: Regenerate database types

**Files:**
- Modify: `src/lib/database.types.ts`

**Step 1: Regenerate**

```bash
npx supabase gen types typescript --linked --schema wpa > src/lib/database.types.ts
```
(equivalently `npm run db:types`). Requires the project to be linked (Task 6.2 step 2).

**Step 2: Verify the diff**

```bash
git diff src/lib/database.types.ts | grep -E "client_id|contract_id" | head
```
Expected: the six tables now show `contract_id`, no `client_id`.

**Step 3: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "chore(step-6): regenerate types after client_id->contract_id rename"
```

---

### Task 6.4: Rename `clientId → contractId` in the four hooks

**Files:**
- Modify: `src/hooks/use-client-baselines.ts`
- Modify: `src/hooks/use-gbp-scores.ts`
- Modify: `src/hooks/use-gbp-analytics.ts`
- Modify: `src/hooks/use-gbp-insights.ts`
- Modify: `src/lib/query-keys.ts` (the `gbpScores`, `gbpInsights`, `clientBaselines`, `gbpAnalytics` key factories reference client)

**Step 1: Rename params, local field refs, and query columns**

In each hook, rename the function param `clientId` → `contractId`, the interface field `client_id` → `contract_id`, and every `.eq('client_id', …)` → `.eq('contract_id', …)`. Update the upsert in `use-gbp-insights.ts`: `onConflict: 'client_id,week_ending'` → `onConflict: 'contract_id,week_ending'` (confirmed against Task 6.2 Step 3). Update the invalidation calls that read `data.client_id` / `variables.client_id` → `.contract_id`.

Example (`use-gbp-scores.ts`):
```ts
export interface GbpScore {
  contract_id: number   // was client_id
  // …
}
export function useGbpScores(contractId: number | null) {   // was clientId
  return useQuery<GbpScore[]>({
    queryKey: queryKeys.gbpScores.byContract(contractId),    // renamed factory
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_gbp_scores')
        .select('*')
        .eq('contract_id', contractId!)                      // was client_id
      // …
    },
  })
}
```

**Step 2: Update the query-key factories** in `src/lib/query-keys.ts` — rename `byClient` → `byContract` (and any `client`-named segment) for these four families. Keep the string segments stable enough that no other consumer breaks; grep for callers in Step 4.

**Step 3: Update the widget prop names** (see Task 6.5) — done as a separate task to keep commits small; this task is hooks + keys only.

**Step 4: Typecheck & lint**

```bash
npm run build   # tsc -b will flag every remaining clientId/client_id mismatch
npm run lint
```
Expected: build fails ONLY at the widget call sites (fixed in Task 6.5) — i.e. the hooks/keys themselves are internally consistent. If build is clean already, even better.

**Step 5: Commit**

```bash
git add src/hooks/use-client-baselines.ts src/hooks/use-gbp-scores.ts src/hooks/use-gbp-analytics.ts src/hooks/use-gbp-insights.ts src/lib/query-keys.ts
git commit -m "refactor(step-6): rename clientId->contractId in GBP hooks + query keys"
```

---

### Task 6.5: Rename `clientId → contractId` in the widgets + call sites

**Files:**
- Modify: `src/components/clients/GbpScoreWidget.tsx`
- Modify: `src/components/clients/GbpInsightsWidget.tsx`
- Modify: `src/components/clients/BaselineWidget.tsx`
- Modify: `src/components/clients/AnalyticsWidget.tsx`
- Modify: `src/components/clients/ClientForm.tsx:242-246`
- Modify: `src/components/tasks/EntityTaskList.tsx:14-26`

**Step 1: Rename the widget props** `clientId: number` → `contractId: number` in each widget's props interface and destructure, and pass `contractId={client.id}` from `ClientForm` (the value is unchanged — `client.id` is already a contract id). `AnalyticsWidget` keeps `clientName` (display only).

**Step 2: Fix `EntityTaskList` naming** — the `contractId?: number` prop is already correctly named; update its doc comment (lines 13-18) to drop the "clientId == contractId … 1:1" language now that the FK exists and the assumption is gone. The prop and logic stay; only the misleading comment changes:

```ts
  /**
   * Contract to scope tasks to when there is no linked business. Clients pass
   * their contract id here (a client IS a wpa_contracts row, so client.id is the
   * contract id — no 1:1 assumption remains now that GBP tables FK to contracts).
   */
  contractId?: number
```

**Step 3: Typecheck & lint**

```bash
npm run build
npm run lint
```
Expected: PASS (all `clientId` references resolved).

**Step 4: Smoke test in dev**

```bash
npm run dev
# Open a client (contract 1 or 2), go to the GBP tab. Score/Insights/Baseline/Analytics load.
```
Verify via `npx tsx run.ts chrome:console '{"url":"http://localhost:5173"}'` (from the mcp-servers dir) — no red errors on the GBP tab.

**Step 5: Commit**

```bash
git add src/components/clients/*.tsx src/components/tasks/EntityTaskList.tsx
git commit -m "refactor(step-6): rename clientId->contractId in GBP widgets; drop stale 1:1 comment"
```

**Step 6 track complete.** FKs restored, orphan gone, naming truthful.

---

# STEP 5 — Finish Pipeline Migration

> Tasks 5.1–5.8 are safe to ship independently. **Tasks 5.9 (enum swap) and 5.10 (drop `contact_status`) are GATED on owner confirmation that Bob's VPS skill writes the new `lifecycle_stage` values.** Do not run them until then.

### Task 5.1: Migration — add reason fields + `dropped` stage value

**Files:**
- Create: `supabase/migrations/20260714020000_pipeline_reason_fields.sql`

**Step 1: Write the migration** (additive only — no enum removal yet, so it's safe pre-gate)

```sql
-- Migration: pipeline reason fields + 'dropped' stage (Phase 2 Step 5, additive)
-- Date: 2026-07-14
-- Rollback: drop the two columns; ALTER TYPE cannot remove an enum value, so a
--   'dropped' value added here is permanent (acceptable — it's part of the target model).

-- New reason fields
ALTER TABLE wpa.wpa_businesses
  ADD COLUMN dropped_reason TEXT
  CHECK (dropped_reason IN ('declined','not_a_fit','no_response'));

ALTER TABLE wpa.wpa_contracts
  ADD COLUMN close_reason TEXT
  CHECK (close_reason IN ('work_completed','parted_ways')),
  ADD COLUMN closed_at TIMESTAMPTZ;

-- Add 'dropped' to the existing enum now (additive; the new_prospect/relationship_ended
-- remap + old-value removal happens in the gated Task 5.9).
ALTER TYPE wpa.lifecycle_stage ADD VALUE IF NOT EXISTS 'dropped';
```

> **Postgres note:** `ALTER TYPE … ADD VALUE` cannot run inside a transaction block with other statements in some PG versions. If `db push` errors on that line, split it into its own migration file (`20260714020001_add_dropped_enum.sql`) containing only the `ADD VALUE`.

**Step 2: Push & verify**

```bash
npx supabase@latest db push
source .env; KEY="$VITE_SUPABASE_ANON_KEY"; URL="$VITE_SUPABASE_URL"
curl -s "$URL/rest/v1/wpa_contracts?select=id,close_reason,closed_at" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: wpa"
```
Expected: contracts return the new (null) columns.

**Step 3: Commit**

```bash
git add supabase/migrations/2026071402*.sql
git commit -m "feat(step-5): add dropped_reason, contract close_reason/closed_at, dropped stage"
```

---

### Task 5.2: Migration — `end_engagement` RPC

**Files:**
- Create: `supabase/migrations/20260714030000_rpc_end_engagement.sql`

**Step 1: Write the RPC** (mirror of `convert_to_client`; drop-then-create per Phase-1 pattern to avoid overload ambiguity — but this is a NEW function so a plain CREATE is fine)

```sql
-- Migration: end_engagement RPC (Phase 2 Step 5)
-- Date: 2026-07-14
-- Rollback: DROP FUNCTION wpa.end_engagement(TEXT, TEXT, TEXT);
-- Sets a former client's stage to relationship_ended, stamps close_reason/closed_at
-- on their most-recent contract, and logs a stage-change activity entry.

CREATE OR REPLACE FUNCTION wpa.end_engagement(
  p_business_id  TEXT,
  p_close_reason TEXT,
  p_actor        TEXT DEFAULT 'bob'
)
RETURNS wpa.wpa_contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wpa
AS $$
DECLARE
  v_contract wpa.wpa_contracts;
BEGIN
  IF p_close_reason NOT IN ('work_completed','parted_ways') THEN
    RAISE EXCEPTION 'invalid close_reason: %', p_close_reason;
  END IF;

  UPDATE wpa.wpa_businesses
    SET lifecycle_stage = 'relationship_ended'
  WHERE id = p_business_id;

  -- Stamp the most-recent contract for this business.
  UPDATE wpa.wpa_contracts
    SET close_reason = p_close_reason,
        closed_at    = NOW()
  WHERE id = (
    SELECT id FROM wpa.wpa_contracts
    WHERE business_id = p_business_id
    ORDER BY created_at DESC
    LIMIT 1
  )
  RETURNING * INTO v_contract;

  INSERT INTO wpa.wpa_activity (business_id, type, summary, actor)
    VALUES (p_business_id, 'stage_change',
            'Engagement ended — ' || p_close_reason, p_actor);

  RETURN v_contract;
END;
$$;

GRANT EXECUTE ON FUNCTION wpa.end_engagement TO anon, authenticated;
```

**Step 2: Push & smoke-test the RPC** (against a throwaway — do NOT run on a real client). Verify it exists:

```bash
npx supabase@latest db push
# confirm function is registered
source .env; KEY="$VITE_SUPABASE_ANON_KEY"; URL="$VITE_SUPABASE_URL"
curl -s -X POST "$URL/rest/v1/rpc/end_engagement" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Profile: wpa" \
  -H "Content-Type: application/json" \
  -d '{"p_business_id":"__nonexistent__","p_close_reason":"work_completed","p_actor":"human"}'
```
Expected: no HTTP 404 for the function (a no-op / null contract for a nonexistent business is fine — it means the function resolved).

**Step 3: Commit**

```bash
git add supabase/migrations/20260714030000_rpc_end_engagement.sql
git commit -m "feat(step-5): add end_engagement RPC (client-side mirror of convert_to_client)"
```

---

### Task 5.3: Define the lifecycle-stage vocabulary in code

**Files:**
- Create: `src/lib/lifecycle.ts`

**Step 1: Centralize the stage list, labels, and reason options** (DRY — every UI touchpoint imports from here)

```ts
// Single source of truth for the lifecycle_stage pipeline vocabulary (see CONTEXT.md).
export type LifecycleStage =
  | 'identified' | 'new_prospect' | 'lead'
  | 'client' | 'dropped' | 'relationship_ended'

// Stages a user can pick directly in the Leads status dropdown.
export const LEAD_DROPDOWN_STAGES = ['identified', 'new_prospect', 'lead', 'dropped'] as const

export const STAGE_LABELS: Record<LifecycleStage, string> = {
  identified: 'Identified',
  new_prospect: 'New Prospect',
  lead: 'Lead',
  client: 'Client',
  dropped: 'Dropped',
  relationship_ended: 'Relationship Ended',
}

export const STAGE_BADGE_CLASSES: Record<LifecycleStage, string> = {
  identified:         'bg-violet-100 text-violet-700 border-violet-200',
  new_prospect:       'bg-orange-100 text-orange-700 border-orange-200',
  lead:               'bg-amber-100 text-amber-700 border-amber-200',
  client:             'bg-green-100 text-green-700 border-green-200',
  dropped:            'bg-slate-200 text-slate-600 border-slate-300',
  relationship_ended: 'bg-slate-100 text-slate-500 border-slate-200',
}

export const DROPPED_REASONS = [
  { value: 'declined', label: 'Declined' },
  { value: 'not_a_fit', label: 'Not a fit' },
  { value: 'no_response', label: 'No response' },
] as const

export const CLOSE_REASONS = [
  { value: 'work_completed', label: 'Work Completed' },
  { value: 'parted_ways', label: 'Parted Ways' },
] as const
```

**Step 2: Typecheck**

```bash
npm run build
```
Expected: PASS (new file, no consumers yet).

**Step 3: Commit**

```bash
git add src/lib/lifecycle.ts
git commit -m "feat(step-5): centralize lifecycle_stage vocabulary, labels, reasons"
```

---

### Task 5.4: Add lifecycle_stage mutations to `use-businesses.ts`

**Files:**
- Modify: `src/hooks/use-businesses.ts`

**Step 1: Add `lifecycle_stage` + `dropped_reason` to the `Business` interface** (keep `contact_status` until Task 5.10 so nothing breaks mid-migration):

```ts
export interface Business {
  // … existing fields …
  contact_status: 'IDENTIFIED' | 'NEW' | 'TARGETED' | 'CONTACTED' | 'REPLIED' | 'CLOSED' | 'CLOSED-WON'  // legacy, removed in Task 5.10
  lifecycle_stage: import('@/lib/lifecycle').LifecycleStage
  dropped_reason: 'declined' | 'not_a_fit' | 'no_response' | null
  // …
}
```

**Step 2: Add `useMoveToStage` (RPC-based, replaces the bare-UPDATE `useUpdateBusinessStatus` for stage moves):**

```ts
export function useMoveToStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: LifecycleStage }) => {
      const { error } = await supabase.rpc('move_to_stage', {
        p_business_id: id, p_stage: stage, p_actor: 'human',
      })
      if (error) throw error
    },
    onSuccess: () => invalidateBusinessCaches(queryClient),
  })
}
```

**Step 3: Add `useMarkDropped` (stage → dropped + reason). `move_to_stage` doesn't set `dropped_reason`, so this does the reason update then the stage move — or extend the RPC. Simplest: UPDATE reason, then RPC for the audited stage move:**

```ts
export function useMarkDropped() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string | null }) => {
      const { error: e1 } = await supabase.from('wpa_businesses')
        .update({ dropped_reason: reason }).eq('id', id)
      if (e1) throw e1
      const { error: e2 } = await supabase.rpc('move_to_stage', {
        p_business_id: id, p_stage: 'dropped', p_actor: 'human',
      })
      if (e2) throw e2
    },
    onSuccess: () => invalidateBusinessCaches(queryClient),
  })
}
```

**Step 4: Add `useEndEngagement` (calls the new RPC):**

```ts
export function useEndEngagement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ business_id, close_reason }: { business_id: string; close_reason: string }) => {
      const { error } = await supabase.rpc('end_engagement', {
        p_business_id: business_id, p_close_reason: close_reason, p_actor: 'human',
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateBusinessCaches(queryClient)
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all })
    },
  })
}
```

**Step 5: Leave `useUpdateBusinessStatus` in place for now** (still used by LeadTable/LeadDetail until Tasks 5.5–5.6 rewire them). It will be deleted in Task 5.7.

**Step 6: Typecheck** — `npm run build`. Expected: PASS (new hooks; `lifecycle_stage` now on the interface). If the `.rpc('move_to_stage', …)` typing complains (generated types may type it 2-arg), add the 3rd param or cast — check `database.types.ts` for the current RPC arg shape.

**Step 7: Commit**

```bash
git add src/hooks/use-businesses.ts
git commit -m "feat(step-5): add RPC-based useMoveToStage/useMarkDropped/useEndEngagement"
```

---

### Task 5.5: Re-key `StatusBadge` to lifecycle_stage

**Files:**
- Modify: `src/components/leads/StatusBadge.tsx`

**Step 1: Replace the `contact_status`-keyed config with the `lifecycle.ts` maps:**

```tsx
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { STAGE_LABELS, STAGE_BADGE_CLASSES, type LifecycleStage } from '@/lib/lifecycle'

interface StatusBadgeProps {
  stage: LifecycleStage | string | null | undefined
  className?: string
}

export function StatusBadge({ stage, className }: StatusBadgeProps) {
  const key = (stage && stage in STAGE_LABELS ? stage : 'identified') as LifecycleStage
  return (
    <Badge variant="outline" className={cn(STAGE_BADGE_CLASSES[key], className)}>
      {STAGE_LABELS[key]}
    </Badge>
  )
}
```

> Prop renamed `status` → `stage`. Every caller (LeadCard, LeadTable, LeadDetail) is updated in Tasks 5.6–5.7.

**Step 2: Typecheck** — `npm run build`. Expected: FAIL at the three callers still passing `status=` (fixed next). That's the expected intermediate state.

**Step 3: Commit** (after 5.6/5.7 make build green — or commit now and let the next tasks fix callers; keep commits small but never leave `main` broken. Commit at end of 5.7 if you prefer one green commit for the badge rewire.)

```bash
git add src/components/leads/StatusBadge.tsx
git commit -m "refactor(step-5): re-key StatusBadge to lifecycle_stage"
```

---

### Task 5.6: Rewire LeadCard + LeadTable to lifecycle_stage

**Files:**
- Modify: `src/components/leads/LeadCard.tsx`
- Modify: `src/components/leads/LeadTable.tsx`

**Step 1: LeadCard** — change `<StatusBadge status={business.contact_status} />` → `<StatusBadge stage={business.lifecycle_stage} />`.

**Step 2: LeadTable** —
- Replace the dropdown's hardcoded `['NEW','IDENTIFIED',…]` list with `LEAD_DROPDOWN_STAGES` mapped through `STAGE_LABELS`.
- `<Select value={biz.contact_status}>` → `value={biz.lifecycle_stage}`.
- `handleStatusChange`: the `CLOSED-WON` special-case → `client` no longer applies (client isn't in the dropdown). Instead: if the chosen stage is `dropped`, open a small reason picker (or default reason null) and call `useMarkDropped`; otherwise call `useMoveToStage`. Convert-to-client stays its own separate button/flow (unchanged).
- Sort-by-status: `a.contact_status.localeCompare(b.contact_status)` → `a.lifecycle_stage.localeCompare(...)`.

```tsx
const moveToStage = useMoveToStage()
const markDropped = useMarkDropped()

function handleStageChange(biz: Business, stage: LifecycleStage) {
  if (stage === 'dropped') markDropped.mutate({ id: biz.id, reason: null })
  else moveToStage.mutate({ id: biz.id, stage })
}
// …
{LEAD_DROPDOWN_STAGES.map((s) => (
  <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
))}
```

**Step 3: Typecheck & lint** — `npm run build && npm run lint`.

**Step 4: Commit**

```bash
git add src/components/leads/LeadCard.tsx src/components/leads/LeadTable.tsx
git commit -m "refactor(step-5): LeadCard/LeadTable use lifecycle_stage + RPC mutations"
```

---

### Task 5.7: Rewire LeadDetail + add Dropped/End-Engagement actions; delete `useUpdateBusinessStatus`

**Files:**
- Modify: `src/components/leads/LeadDetail.tsx`
- Modify: `src/hooks/use-businesses.ts` (delete `useUpdateBusinessStatus`)

**Step 1: LeadDetail status control** — mirror LeadTable:
- `localStatus` state → `localStage: LifecycleStage`, seeded from `business.lifecycle_stage`.
- `<StatusBadge status=… />` → `stage={localStage ?? business.lifecycle_stage}`.
- Dropdown options → `LEAD_DROPDOWN_STAGES` + `STAGE_LABELS`.
- `handleStatusChange`: `dropped` → open a reason dropdown (`DROPPED_REASONS`) then `useMarkDropped`; other stages → `useMoveToStage`. Keep the existing Convert-to-Client dialog for the client transition (triggered by a dedicated "Convert to Client" button, not the stage dropdown).

**Step 2: Add an "End Engagement" affordance** — only shown when `business.lifecycle_stage === 'client'`: a button opening a small dialog with a `CLOSE_REASONS` picker → `useEndEngagement`. (Leads that aren't clients don't see it.)

**Step 3: Delete `useUpdateBusinessStatus`** from `use-businesses.ts` (now unused — grep to confirm no remaining imports):

```bash
grep -rn "useUpdateBusinessStatus" src/
```
Expected after removal: no matches.

**Step 4: Typecheck & lint** — `npm run build && npm run lint`. Expected: PASS (all badge callers now on `stage`).

**Step 5: Smoke test**

```bash
npm run dev
# Leads page: change a lead's stage via dropdown → badge updates, activity feed shows a stage_change entry.
# Set a lead to Dropped → reason picker → saved; badge = Dropped.
# Open the one client (contract 1/2) → End Engagement button visible → pick reason → stage = Relationship Ended.
```
Check console: `npx tsx run.ts chrome:console '{"url":"http://localhost:5173"}'` — no red errors.

**Step 6: Commit**

```bash
git add src/components/leads/LeadDetail.tsx src/hooks/use-businesses.ts
git commit -m "refactor(step-5): LeadDetail lifecycle_stage + Dropped/End-Engagement actions; drop useUpdateBusinessStatus"
```

---

### Task 5.8: Update Discovery + filters + businesses query off `contact_status`

**Files:**
- Modify: `src/hooks/use-discovery.ts` (`useDiscoveryStats` reads `contact_status='IDENTIFIED'`)
- Modify: `src/hooks/use-businesses.ts` (`useBusinesses` filters `.in('contact_status', …)`)
- Modify: `src/pages/DiscoveryPage.tsx` and any LeadsPage filter chips referencing the 7 legacy statuses

**Step 1: `useDiscoveryStats`** — `.eq('contact_status', 'IDENTIFIED')` → `.eq('lifecycle_stage', 'identified')` for `newCount`.

**Step 2: `useBusinesses`** — the `statusFilter` param filters `.in('contact_status', statusFilter)`. Switch to `.in('lifecycle_stage', stageFilter)` and change the filter UI to emit `LifecycleStage[]` values. Update `queryKeys.businesses.list(options)` inputs accordingly.

**Step 3: Filter chips** — find any hardcoded legacy status arrays in `DiscoveryPage.tsx` / `LeadsPage.tsx` and replace with `LEAD_DROPDOWN_STAGES` (+ optionally `client`/`relationship_ended` for filtering, even though not dropdown-settable). Grep:

```bash
grep -rn "IDENTIFIED\|CONTACTED\|CLOSED-WON\|contact_status" src/pages src/components
```
Expected after this task: no `contact_status` references remain in `src/` except the soon-to-be-removed `Business.contact_status` field.

**Step 4: Typecheck, lint, smoke test** — `npm run build && npm run lint`; dev-server check that Discovery stats + Leads filters work on `lifecycle_stage`.

**Step 5: Commit**

```bash
git add src/hooks/use-discovery.ts src/hooks/use-businesses.ts src/pages/DiscoveryPage.tsx
git commit -m "refactor(step-5): Discovery stats + Leads filters read lifecycle_stage"
```

**At this point the UI is fully on `lifecycle_stage`.** `contact_status` is written only by the sync trigger. STOP and confirm the gate before 5.9.

---

### Task 5.9 (GATED): Enum remap — swap to the final lifecycle_stage values

> **DO NOT START until the owner confirms Bob's VPS skill writes `identified / new_prospect / lead / client / dropped / relationship_ended` (not old values, not `contact_status`).**

**Files:**
- Create: `supabase/migrations/20260714040000_lifecycle_enum_remap.sql`

**Step 1: Write the enum swap.** Postgres can't drop enum values, so this rebuilds the type: add `new_prospect`/`relationship_ended` values (if not present), remap all rows, then rename old type → create new type → migrate the column → drop old type. Because `contact_status` still mirrors via the trigger, **disable the sync trigger during the remap** and drop it in Task 5.10.

```sql
-- Migration: remap lifecycle_stage to the final vocabulary (Phase 2 Step 5, GATED)
-- Date: 2026-07-14
-- PREREQUISITE: Bob's skill already writes the new values. Hard cutover.
-- Rollback: restore from a pre-migration pg_dump of wpa.wpa_businesses.lifecycle_stage.

BEGIN;

ALTER TABLE wpa.wpa_businesses DISABLE TRIGGER trg_a_sync_pipeline;

-- 1) Remap existing rows to the target set (old values -> new).
--    Cast column to text temporarily to allow assigning values not yet in a single enum.
ALTER TABLE wpa.wpa_businesses ALTER COLUMN lifecycle_stage TYPE TEXT;

UPDATE wpa.wpa_businesses SET lifecycle_stage = 'new_prospect'
  WHERE lifecycle_stage IN ('new','prospect');
UPDATE wpa.wpa_businesses SET lifecycle_stage = 'lead'
  WHERE lifecycle_stage IN ('qualified','proposal');   -- 'lead' stays 'lead'
UPDATE wpa.wpa_businesses SET lifecycle_stage = 'relationship_ended'
  WHERE lifecycle_stage = 'churned';
-- 'identified', 'client', 'dropped' unchanged.

-- 2) Rebuild the enum type with exactly the target values.
DROP TYPE IF EXISTS wpa.lifecycle_stage_new;
CREATE TYPE wpa.lifecycle_stage_new AS ENUM
  ('identified','new_prospect','lead','client','dropped','relationship_ended');

ALTER TABLE wpa.wpa_businesses
  ALTER COLUMN lifecycle_stage DROP DEFAULT,
  ALTER COLUMN lifecycle_stage TYPE wpa.lifecycle_stage_new
    USING lifecycle_stage::wpa.lifecycle_stage_new,
  ALTER COLUMN lifecycle_stage SET DEFAULT 'identified';

-- 3) Swap type names.
DROP TYPE wpa.lifecycle_stage;
ALTER TYPE wpa.lifecycle_stage_new RENAME TO lifecycle_stage;

-- Re-enable the trigger only if contact_status is still around; Task 5.10 drops both.
ALTER TABLE wpa.wpa_businesses ENABLE TRIGGER trg_a_sync_pipeline;

COMMIT;
```

> The `move_to_stage` RPC casts `p_stage::wpa.lifecycle_stage` — after the rename the type name is unchanged, so the RPC keeps working. Verify no other object references the old enum values (the sync trigger's mapping functions do — they're dropped in 5.10).

**Step 2: Push & verify the distribution**

```bash
npx supabase@latest db push
source .env; KEY="$VITE_SUPABASE_ANON_KEY"; URL="$VITE_SUPABASE_URL"
curl -s "$URL/rest/v1/wpa_businesses?select=lifecycle_stage" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: wpa" \
  | python3 -c "import sys,json,collections; print(collections.Counter(r['lifecycle_stage'] for r in json.load(sys.stdin)))"
```
Expected: only the six target values appear; no `new/prospect/qualified/proposal/churned`.

**Step 3: Regenerate types + commit**

```bash
npm run db:types
git add supabase/migrations/20260714040000_lifecycle_enum_remap.sql src/lib/database.types.ts
git commit -m "feat(step-5): remap lifecycle_stage to final 6-value vocabulary (gated)"
```

---

### Task 5.10 (GATED): Drop `contact_status` + the sync trigger

> Only after 5.9 is verified and Bob is confirmed off `contact_status`.

**Files:**
- Create: `supabase/migrations/20260714050000_drop_contact_status.sql`
- Modify: `src/hooks/use-businesses.ts` (remove `contact_status` from `Business`)

**Step 1: Write the drop migration**

```sql
-- Migration: drop legacy contact_status + sync trigger (Phase 2 Step 5 final)
-- Date: 2026-07-14
-- PREREQUISITE: UI fully on lifecycle_stage (Tasks 5.5-5.8); Bob off contact_status.
-- Rollback: re-add contact_status + the sync trigger from 20260713010100.

DROP TRIGGER IF EXISTS trg_a_sync_pipeline ON wpa.wpa_businesses;
DROP FUNCTION IF EXISTS wpa.sync_pipeline_fields();
DROP FUNCTION IF EXISTS wpa.stage_from_contact_status(TEXT);
DROP FUNCTION IF EXISTS wpa.contact_status_from_stage(wpa.lifecycle_stage);

ALTER TABLE wpa.wpa_businesses DROP COLUMN contact_status;
```

**Step 2: Push, regenerate types, remove the field from `Business`** (and any last references — grep `contact_status` in `src/`, expect zero after).

```bash
npx supabase@latest db push
npm run db:types
grep -rn "contact_status" src/    # expect no matches
npm run build && npm run lint
```

**Step 3: Update CONTEXT.md** — remove the "Migration status" note and the legacy-mirror sentence in the RPC section now that they're done. Move this plan to `.agent/Tasks/completed/` with a work log per `CLAUDE.md`.

**Step 4: Commit**

```bash
git add supabase/migrations/20260714050000_drop_contact_status.sql src/hooks/use-businesses.ts src/lib/database.types.ts CONTEXT.md
git commit -m "feat(step-5): drop legacy contact_status + sync trigger; UI fully on lifecycle_stage"
```

---

## Final Verification (whole feature)

1. `npm run build` + `npm run lint` clean.
2. `git grep contact_status src/` → no matches; `git grep client_id src/` → no matches (all `contract_id`).
3. Live: `wpa_businesses.lifecycle_stage` distribution shows only the 6 target values; `contact_status` column gone.
4. Live: all six GBP/baseline tables expose `contract_id` with a FK; anti-join to `wpa_contracts` returns zero orphans.
5. Dev-server smoke: Leads dropdown shows Identified/New Prospect/Lead/Dropped; setting Dropped captures a reason; Convert-to-Client still works; a client shows End Engagement → Relationship Ended with a close reason; GBP tab loads for contracts 1 & 2; every stage change appears in the activity feed with `actor='human'`.
6. `.env`-driven build deploys via CI on merge to `main` (test locally first per project rules).

## Open Coordination Item (owner)

- **Bob cutover (gates Tasks 5.9–5.10):** Bob's VPS skill must (a) write the new `lifecycle_stage` values and (b) stop reading/writing `contact_status`, before the enum remap and column drop run. Everything else in this plan ships without waiting on Bob.
