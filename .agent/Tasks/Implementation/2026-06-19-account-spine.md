# Account Spine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish `wpa_businesses` as the canonical Account entity, unify contacts and activity under `business_id`, replace `wpa_clients` with a thin `wpa_contracts` record, and expose `convert_to_client()` + `append_activity()` as Postgres RPCs reachable by Hermes.

**Architecture:** The `businesses` table gains a `lifecycle_stage` column (`lead | client | churned`) that replaces the semantic role of `contact_status = 'CLOSED-WON'`. A new `wpa_contracts` table holds one row per signed engagement (supports re-engagement history). Contacts drop their `client_id` FK and attach exclusively to `business_id`. Two activity tables and two widget components collapse into one each. All business-rule mutations (`convert_to_client`, `append_activity`) live in Postgres RPCs so Hermes can call them without re-implementing React hook logic.

**Tech Stack:** PostgreSQL (Supabase, schema `wpa`), Supabase JS client v2, React 18, TypeScript, TanStack Query v5, Vite. Migrations applied with `npx supabase@latest db push`. Schema verified via `npx tsx run.ts supabase:sql` (MCP-as-code, project alias `maintenance-log`).

**Read first:** `CONTEXT.md` for domain vocabulary. `CLAUDE.md` for Supabase project ref and MCP alias. `.agent/README.md` for project overview.

**MCP-as-code path:** `cd ~/WhitePineTech/Tools/mcp-servers && npx tsx run.ts supabase:sql '{"project":"maintenance-log","sql":"..."}'`

---

## Phase 1 — Database Migrations

### Task 1: Add `lifecycle_stage` to `wpa_businesses`

**Files:**
- Create: `supabase/migrations/<timestamp>_add_lifecycle_stage.sql` (run `npx supabase@latest migration new add_lifecycle_stage`)

**Step 1: Create the migration file with this SQL**

```sql
-- Migration: add lifecycle_stage to wpa_businesses
-- Rollback: ALTER TABLE wpa.wpa_businesses DROP COLUMN lifecycle_stage; DROP TYPE wpa.lifecycle_stage;

CREATE TYPE wpa.lifecycle_stage AS ENUM ('lead', 'client', 'churned');

ALTER TABLE wpa.wpa_businesses
  ADD COLUMN lifecycle_stage wpa.lifecycle_stage NOT NULL DEFAULT 'lead';

-- Backfill: any business with a wpa_clients row is already a client
UPDATE wpa.wpa_businesses b
SET lifecycle_stage = 'client'
WHERE EXISTS (
  SELECT 1 FROM wpa.wpa_clients c WHERE c.business_id = b.id
);
```

**Step 2: Push and verify**

```bash
export SUPABASE_ACCESS_TOKEN="<token from .env or CLAUDE.md>"
npx supabase@latest link --project-ref klyzdnocgrvassppripi
npx supabase@latest db push
```

Expected: migration applied with no errors.

**Step 3: Verify via MCP**

```bash
cd ~/WhitePineTech/Tools/mcp-servers
npx tsx run.ts supabase:sql '{"project":"maintenance-log","sql":"SELECT lifecycle_stage, COUNT(*) FROM wpa.wpa_businesses GROUP BY lifecycle_stage"}'
```

Expected: rows show `lead: N`, `client: 3` (matching existing wpa_clients count).

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add lifecycle_stage enum to wpa_businesses"
```

---

### Task 2: Create `wpa_contracts` + migrate from `wpa_clients`

**Files:**
- Create: `supabase/migrations/<timestamp>_create_wpa_contracts.sql`

**Step 1: Create migration**

```sql
-- Migration: create wpa_contracts, migrate from wpa_clients
-- Rollback: DROP TABLE wpa.wpa_contracts;

CREATE TABLE wpa.wpa_contracts (
  id          SERIAL PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES wpa.wpa_businesses(id),
  service_tier TEXT NOT NULL,
  monthly_revenue NUMERIC(10,2) NOT NULL DEFAULT 0,
  current_phase   TEXT NOT NULL DEFAULT '',
  next_action     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'churned')),
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date        DATE,
  notes           TEXT NOT NULL DEFAULT '',
  folder_path     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate existing wpa_clients rows (3 rows)
INSERT INTO wpa.wpa_contracts
  (business_id, service_tier, monthly_revenue, current_phase, next_action,
   status, start_date, notes, folder_path, created_at)
SELECT
  business_id,
  service_tier,
  monthly_revenue,
  COALESCE(current_phase, ''),
  COALESCE(next_action, ''),
  status,
  start_date::DATE,
  COALESCE(notes, ''),
  folder_path,
  created_at
FROM wpa.wpa_clients
WHERE business_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON wpa.wpa_contracts TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE wpa.wpa_contracts_id_seq TO anon, authenticated;
```

**Step 2: Push**

```bash
npx supabase@latest db push
```

**Step 3: Verify migration**

```bash
npx tsx run.ts supabase:sql '{"project":"maintenance-log","sql":"SELECT id, business_id, service_tier, status FROM wpa.wpa_contracts"}'
```

Expected: 3 rows matching existing clients.

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): create wpa_contracts, migrate from wpa_clients"
```

---

### Task 3: Fix `wpa_contacts` — drop `client_id`, enforce `business_id NOT NULL`

**Files:**
- Create: `supabase/migrations/<timestamp>_contacts_business_id_only.sql`

**Step 1: Check for contacts with `client_id` but null `business_id` first**

```bash
npx tsx run.ts supabase:sql '{"project":"maintenance-log","sql":"SELECT id, business_id, client_id, name FROM wpa.wpa_contacts WHERE business_id IS NULL"}'
```

If any rows returned: they need `business_id` filled in via their `client_id` join before the column drop.

**Step 2: Create migration**

```sql
-- Migration: contacts attach to business only
-- Rollback: ALTER TABLE wpa.wpa_contacts ADD COLUMN client_id INT;

-- Backfill any contacts that have only client_id (safety net)
UPDATE wpa.wpa_contacts c
SET business_id = cl.business_id
FROM wpa.wpa_clients cl
WHERE c.client_id = cl.id
  AND c.business_id IS NULL
  AND cl.business_id IS NOT NULL;

-- Remove the XOR ambiguity
ALTER TABLE wpa.wpa_contacts DROP COLUMN IF EXISTS client_id;
ALTER TABLE wpa.wpa_contacts ALTER COLUMN business_id SET NOT NULL;
```

**Step 3: Push and verify**

```bash
npx supabase@latest db push
npx tsx run.ts supabase:sql '{"project":"maintenance-log","sql":"SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema='\''wpa'\'' AND table_name='\''wpa_contacts'\''"}'
```

Expected: `client_id` gone, `business_id` shows `is_nullable: NO`.

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): contacts attach to business_id only, drop client_id"
```

---

### Task 4: Create unified `wpa_activity` table + migrate both activity tables

**Files:**
- Create: `supabase/migrations/<timestamp>_create_wpa_activity.sql`

**Step 1: Create migration**

```sql
-- Migration: unified activity log on business_id
-- Rollback: DROP TABLE wpa.wpa_activity;

CREATE TABLE wpa.wpa_activity (
  id          SERIAL PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES wpa.wpa_businesses(id),
  type        TEXT NOT NULL CHECK (type IN ('call','email','meeting','text','action','note','stage_change')),
  summary     TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate from wpa_business_activity
INSERT INTO wpa.wpa_activity (business_id, type, summary, occurred_at, created_at)
SELECT business_id, type, summary, occurred_at, created_at
FROM wpa.wpa_business_activity;

-- Migrate from wpa_client_activity (join through wpa_clients to get business_id)
INSERT INTO wpa.wpa_activity (business_id, type, summary, occurred_at, created_at)
SELECT cl.business_id, ca.type, ca.summary, ca.occurred_at, ca.created_at
FROM wpa.wpa_client_activity ca
JOIN wpa.wpa_clients cl ON ca.client_id = cl.id
WHERE cl.business_id IS NOT NULL;

GRANT SELECT, INSERT ON wpa.wpa_activity TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE wpa.wpa_activity_id_seq TO anon, authenticated;
```

**Step 2: Push and verify**

```bash
npx supabase@latest db push
npx tsx run.ts supabase:sql '{"project":"maintenance-log","sql":"SELECT business_id, type, summary FROM wpa.wpa_activity ORDER BY occurred_at DESC"}'
```

Expected: all rows from both old tables combined.

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): create unified wpa_activity, migrate from both activity tables"
```

---

### Task 5: Create `convert_to_client()` RPC

**Files:**
- Create: `supabase/migrations/<timestamp>_rpc_convert_to_client.sql`

**Step 1: Create migration**

```sql
-- Migration: convert_to_client RPC
-- Rollback: DROP FUNCTION wpa.convert_to_client;

CREATE OR REPLACE FUNCTION wpa.convert_to_client(
  p_business_id   TEXT,
  p_service_tier  TEXT,
  p_monthly_revenue NUMERIC DEFAULT 0
)
RETURNS wpa.wpa_contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wpa
AS $$
DECLARE
  v_contract wpa.wpa_contracts;
BEGIN
  UPDATE wpa.wpa_businesses
    SET lifecycle_stage = 'client'
  WHERE id = p_business_id;

  INSERT INTO wpa.wpa_contracts (business_id, service_tier, monthly_revenue)
    VALUES (p_business_id, p_service_tier, p_monthly_revenue)
  RETURNING * INTO v_contract;

  INSERT INTO wpa.wpa_activity (business_id, type, summary)
    VALUES (p_business_id, 'stage_change', 'Converted to client — ' || p_service_tier);

  RETURN v_contract;
END;
$$;

GRANT EXECUTE ON FUNCTION wpa.convert_to_client TO anon, authenticated;
```

**Step 2: Push**

```bash
npx supabase@latest db push
```

**Step 3: Smoke-test the RPC via MCP (use a real business_id from your DB)**

```bash
npx tsx run.ts supabase:sql '{"project":"maintenance-log","sql":"SELECT id FROM wpa.wpa_businesses WHERE lifecycle_stage='\''lead'\'' LIMIT 1"}'
# Note the id, then:
npx tsx run.ts supabase:sql '{"project":"maintenance-log","sql":"SELECT * FROM wpa.convert_to_client('\''<id>'\'', '\''Lazy Ranking'\'', 500)"}'
```

Expected: returns a contracts row. Check `wpa_activity` for the stage_change entry. Then roll it back manually:

```bash
npx tsx run.ts supabase:sql '{"project":"maintenance-log","sql":"UPDATE wpa.wpa_businesses SET lifecycle_stage='\''lead'\'' WHERE id='\''<id>'\''; DELETE FROM wpa.wpa_contracts WHERE business_id='\''<id>'\'' AND service_tier='\''Lazy Ranking'\''"}'
```

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add convert_to_client() RPC"
```

---

### Task 6: Create `append_activity()` RPC

**Files:**
- Create: `supabase/migrations/<timestamp>_rpc_append_activity.sql`

**Step 1: Create migration**

```sql
-- Migration: append_activity RPC
-- Rollback: DROP FUNCTION wpa.append_activity;

CREATE OR REPLACE FUNCTION wpa.append_activity(
  p_business_id TEXT,
  p_type        TEXT,
  p_summary     TEXT,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS wpa.wpa_activity
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wpa
AS $$
DECLARE
  v_activity wpa.wpa_activity;
BEGIN
  INSERT INTO wpa.wpa_activity (business_id, type, summary, occurred_at)
    VALUES (p_business_id, p_type, p_summary, p_occurred_at)
  RETURNING * INTO v_activity;

  RETURN v_activity;
END;
$$;

GRANT EXECUTE ON FUNCTION wpa.append_activity TO anon, authenticated;
```

**Step 2: Push and smoke-test**

```bash
npx supabase@latest db push
npx tsx run.ts supabase:sql '{"project":"maintenance-log","sql":"SELECT * FROM wpa.append_activity('\''<any-real-business-id>'\'', '\''note'\'', '\''RPC smoke test'\'')"}'
```

Expected: returns an activity row. Clean up:

```bash
npx tsx run.ts supabase:sql '{"project":"maintenance-log","sql":"DELETE FROM wpa.wpa_activity WHERE summary='\''RPC smoke test'\''"}'
```

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add append_activity() RPC"
```

---

### Task 7: Drop old tables

> **Do this last** — only after all hook/component consumers are updated and verified.

**Files:**
- Create: `supabase/migrations/<timestamp>_drop_legacy_tables.sql`

**Step 1: Verify no app code still references old tables**

```bash
grep -rn "wpa_client_activity\|wpa_business_activity\|wpa_clients" src/ --include="*.ts" --include="*.tsx"
```

Expected: zero results. If any results appear, stop and fix those files first.

**Step 2: Create migration**

```sql
-- Migration: drop legacy tables (data already migrated)
-- Rollback: (non-trivial — re-create from backups; do NOT run on production without backup)

DROP TABLE IF EXISTS wpa.wpa_client_activity;
DROP TABLE IF EXISTS wpa.wpa_business_activity;
DROP TABLE IF EXISTS wpa.wpa_clients;
```

**Step 3: Push**

```bash
npx supabase@latest db push
```

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): drop legacy wpa_clients, wpa_client_activity, wpa_business_activity"
```

---

## Phase 2 — Hook Layer

### Task 8: Create `src/hooks/use-activity.ts`

Replaces both `use-client-activity.ts` and `use-business-activity.ts`.

**Files:**
- Create: `src/hooks/use-activity.ts`

**Step 1: Write the file**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ActivityType = 'call' | 'email' | 'meeting' | 'text' | 'action' | 'note' | 'stage_change'

export interface Activity {
  id: number
  business_id: string
  type: ActivityType
  summary: string
  occurred_at: string
  created_at: string
}

export function useActivity(businessId: string | null) {
  return useQuery<Activity[]>({
    queryKey: ['activity', businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_activity')
        .select('*')
        .eq('business_id', businessId!)
        .order('occurred_at', { ascending: false })
      if (error) throw error
      return (data as Activity[]) ?? []
    },
  })
}

export function useAddActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      business_id,
      type,
      summary,
      occurred_at,
    }: {
      business_id: string
      type: ActivityType
      summary: string
      occurred_at?: string
    }) => {
      const { data, error } = await supabase.rpc('append_activity', {
        p_business_id: business_id,
        p_type: type,
        p_summary: summary,
        p_occurred_at: occurred_at ?? new Date().toISOString(),
      })
      if (error) throw error
      return data as Activity
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['activity', vars.business_id] })
    },
  })
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors on the new file.

**Step 3: Commit**

```bash
git add src/hooks/use-activity.ts
git commit -m "feat(hooks): add unified use-activity hook backed by wpa_activity + append_activity RPC"
```

---

### Task 9: Update `src/hooks/use-contacts.ts`

Remove `client_id` from the interface, remove `useClientContacts`, clean up all `client_id` references.

**Files:**
- Modify: `src/hooks/use-contacts.ts`

**Step 1: Update the `Contact` interface — remove `client_id`**

```typescript
export interface Contact {
  id: number
  business_id: string          // was string | null — now required
  name: string
  last_name: string
  role: string
  phone: string
  email: string
  is_primary: boolean
  notes: string
  created_at: string
  updated_at: string
}
```

**Step 2: Delete the `useClientContacts` function entirely** (lines ~47-62 in the current file).

**Step 3: Update `useAddContact` — remove `client_id` from the mutation type and `onSuccess`**

```typescript
export function useAddContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('wpa_contacts')
        .insert(contact)
        .select()
        .single()
      if (error) throw error
      return data as Contact
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['contacts', 'business', vars.business_id] })
    },
  })
}
```

**Step 4: Update `useUpdateContact` and `useDeleteContact`** — remove all `client_id` branches in `onSuccess`. Both should only invalidate `['contacts', 'business', data.business_id]`.

**Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: errors pointing to callers that still pass `client_id` — fix those in later tasks.

**Step 6: Commit (even with type errors — tracks the hook change atomically)**

```bash
git add src/hooks/use-contacts.ts
git commit -m "feat(hooks): contacts attach to business_id only, drop client_id"
```

---

### Task 10: Update `useConvertToClient` in `src/hooks/use-businesses.ts`

Replace the two-step React mutation with a single RPC call.

**Files:**
- Modify: `src/hooks/use-businesses.ts` (around line 262)

**Step 1: Replace the `useConvertToClient` function**

Find the existing `useConvertToClient` (currently ~L262-307) and replace it with:

```typescript
export function useConvertToClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      business_id,
      service_tier,
      monthly_revenue,
    }: {
      business_id: string
      service_tier: string
      monthly_revenue?: number
    }) => {
      const { data, error } = await supabase.rpc('convert_to_client', {
        p_business_id: business_id,
        p_service_tier: service_tier,
        p_monthly_revenue: monthly_revenue ?? 0,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
    },
  })
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/hooks/use-businesses.ts
git commit -m "feat(hooks): useConvertToClient calls convert_to_client() RPC"
```

---

### Task 11: Create `src/hooks/use-contracts.ts` (replaces `use-clients.ts`)

**Files:**
- Create: `src/hooks/use-contracts.ts`

**Step 1: Write the file**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ServiceTier = 'Lazy Ranking' | 'Core 30' | 'Geographic Expansion' | 'Quick Win'
export type ContractStatus = 'active' | 'paused' | 'churned'

export interface Contract {
  id: number
  business_id: string
  service_tier: ServiceTier
  monthly_revenue: number
  current_phase: string
  next_action: string
  status: ContractStatus
  start_date: string
  end_date: string | null
  notes: string
  folder_path: string | null
  created_at: string
  updated_at: string
}

export type ContractUpdate = Partial<Omit<Contract, 'id' | 'business_id' | 'created_at'>> & { id: number }

export function useContracts() {
  return useQuery<Contract[]>({
    queryKey: ['contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_contracts')
        .select('*, wpa_businesses(name, website_url, phone, address)')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data as Contract[]) ?? []
    },
  })
}

export function useUpdateContract() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: ContractUpdate) => {
      const { data, error } = await supabase
        .from('wpa_contracts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Contract
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
    },
  })
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/hooks/use-contracts.ts
git commit -m "feat(hooks): add use-contracts hook backed by wpa_contracts"
```

---

## Phase 3 — Components

### Task 12: Create unified `src/components/shared/ActivityFeed.tsx`

Replaces both `CommLogWidget` (takes `clientId`) and `BusinessCommLogWidget` (takes `businessId`). New component takes only `businessId`.

**Files:**
- Create: `src/components/shared/ActivityFeed.tsx`

**Step 1: Write the file** (take the body of `BusinessCommLogWidget.tsx` and update imports)

```typescript
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useActivity, useAddActivity, type Activity, type ActivityType } from '@/hooks/use-activity'
import { formatDate } from '@/lib/format'

interface ActivityFeedProps {
  businessId: string
}

const ACTIVITY_TYPES: ActivityType[] = ['call', 'email', 'meeting', 'text', 'action', 'note']

const typeBadgeConfig: Record<ActivityType, { label: string; className: string }> = {
  call:         { label: 'Call',         className: 'bg-green-100 text-green-800 border-green-200' },
  email:        { label: 'Email',        className: 'bg-blue-100 text-blue-800 border-blue-200' },
  meeting:      { label: 'Meeting',      className: 'bg-purple-100 text-purple-800 border-purple-200' },
  text:         { label: 'Text',         className: 'bg-amber-100 text-amber-800 border-amber-200' },
  action:       { label: 'Action',       className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  note:         { label: 'Note',         className: 'bg-gray-100 text-gray-800 border-gray-200' },
  stage_change: { label: 'Stage',        className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ActivityFeed({ businessId }: ActivityFeedProps) {
  const { data: activities = [] } = useActivity(businessId)
  const addActivity = useAddActivity()

  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<ActivityType>('note')
  const [summary, setSummary] = useState('')
  const [date, setDate] = useState(todayISO)

  const recent = activities.slice(0, 10)

  function resetForm() {
    setType('note')
    setSummary('')
    setDate(todayISO())
    setShowForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim()) return
    await addActivity.mutateAsync({
      business_id: businessId,
      type,
      summary: summary.trim(),
      occurred_at: (date || todayISO()) + 'T00:00:00Z',
    })
    resetForm()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Activity Log</span>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(v => !v)}>
          + Log Activity
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border p-3 bg-muted/10">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Type</label>
              <Select value={type} onValueChange={v => setType(v as ActivityType)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Date</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Summary *</label>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={2}
              placeholder="What happened?"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={resetForm}>Cancel</Button>
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={addActivity.isPending}>
              {addActivity.isPending ? 'Saving...' : 'Log'}
            </Button>
          </div>
        </form>
      )}

      {recent.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground italic">No activity logged yet</p>
      )}

      <div className="space-y-1">
        {recent.map((activity: Activity) => {
          const badge = typeBadgeConfig[activity.type] ?? typeBadgeConfig.note
          return (
            <div key={activity.id} className="flex items-start gap-2 p-2 rounded-md border bg-card">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 shrink-0 mt-0.5 ${badge.className}`}>
                {badge.label}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-2">{activity.summary}</p>
                <span className="text-xs text-muted-foreground">{formatDate(activity.occurred_at)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/shared/ActivityFeed.tsx
git commit -m "feat(ui): add unified ActivityFeed component"
```

---

### Task 13: Update `src/components/contacts/ContactList.tsx`

Remove the `clientId` prop and the `useClientContacts` fork at lines 93-99.

**Files:**
- Modify: `src/components/contacts/ContactList.tsx`

**Step 1: Find the component's prop interface and remove `clientId`**

The component currently accepts `{ businessId, clientId }`. Change it to `{ businessId: string }` only.

**Step 2: Remove the `useClientContacts` import and the fork logic** (~lines 93-99)

Currently it branches: if `clientId` use `useClientContacts`, else use `useBusinessContacts`. After edit, always call `useBusinessContacts(businessId)`.

**Step 3: Remove `clientId` from the `<ContactForm>` call** (line ~83)

`<ContactForm businessId={businessId} onDone={...} />` — no `clientId` prop.

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/contacts/ContactList.tsx
git commit -m "feat(ui): ContactList uses business_id only, drop client fork"
```

---

### Task 14: Update `src/components/leads/ConvertToClientDialog.tsx`

The dialog currently passes the full `Business` object to `useConvertToClient`. Update it to pass `business.id` explicitly, matching the new RPC signature.

**Files:**
- Modify: `src/components/leads/ConvertToClientDialog.tsx`

**Step 1: Update the `mutateAsync` call in `handleConvert`**

```typescript
async function handleConvert() {
  if (!business) return
  setSubmitting(true)
  try {
    await convertToClient.mutateAsync({
      business_id: business.id,           // was: business (full object)
      service_tier: serviceTier,
      monthly_revenue: monthlyRevenue ? Number(monthlyRevenue) : 0,
    })
    onOpenChange(false)
    setServiceTier('Lazy Ranking')
    setMonthlyRevenue('')
  } finally {
    setSubmitting(false)
  }
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/leads/ConvertToClientDialog.tsx
git commit -m "feat(ui): ConvertToClientDialog passes business_id to RPC"
```

---

### Task 15: Update `src/components/clients/ClientForm.tsx`

Replace `CommLogWidget` (takes `clientId`) with `ActivityFeed` (takes `businessId`). Also update imports from `use-clients` → `use-contracts`.

**Files:**
- Modify: `src/components/clients/ClientForm.tsx`

**Step 1: Replace imports at top of file**

```typescript
// Remove:
import { useCreateClient, useUpdateClient } from '@/hooks/use-clients'
import type { Client, ClientInsert, ServiceTier, ClientStatus } from '@/hooks/use-clients'
import { CommLogWidget } from '@/components/clients/CommLogWidget'

// Add:
import { useUpdateContract } from '@/hooks/use-contracts'
import type { Contract, ContractUpdate, ServiceTier, ContractStatus } from '@/hooks/use-contracts'
import { ActivityFeed } from '@/components/shared/ActivityFeed'
```

**Step 2: Update all type references** — `Client` → `Contract`, `ClientInsert` → `ContractUpdate`, `ClientStatus` → `ContractStatus`.

**Step 3: Replace the `CommLogWidget` usage** (line ~286)

```typescript
// Remove:
<CommLogWidget clientId={client.id} />

// Add:
<ActivityFeed businessId={client.business_id} />
```

Note: `client.business_id` is guaranteed non-null after the schema migration.

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/clients/ClientForm.tsx
git commit -m "feat(ui): ClientForm uses contracts hook and ActivityFeed"
```

---

### Task 16: Update `src/components/clients/ClientBoard.tsx` and `ClientCard.tsx`

**Files:**
- Modify: `src/components/clients/ClientBoard.tsx`
- Modify: `src/components/clients/ClientCard.tsx`

**Step 1: In `ClientBoard.tsx` — swap hook and type**

```typescript
// Remove:
import { useClients } from '@/hooks/use-clients'
import type { Client } from '@/hooks/use-clients'

// Add:
import { useContracts } from '@/hooks/use-contracts'
import type { Contract } from '@/hooks/use-contracts'
```

Replace `useClients()` → `useContracts()`, and `Client` → `Contract` in props passed to `ClientCard`.

**Step 2: In `ClientCard.tsx` — swap type imports**

```typescript
// Remove:
import type { Client, ServiceTier, ClientStatus } from '@/hooks/use-clients'

// Add:
import type { Contract, ServiceTier, ContractStatus } from '@/hooks/use-contracts'
```

Update the component's prop type from `Client` → `Contract`.

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/clients/ClientBoard.tsx src/components/clients/ClientCard.tsx
git commit -m "feat(ui): ClientBoard and ClientCard use contracts types"
```

---

### Task 17: Update `src/components/tasks/TaskForm.tsx` and `src/components/projects/ProjectForm.tsx`

Both use `useClients()` to populate a dropdown list of client names. After the refactor, they should query active contracts joined with business names.

**Files:**
- Modify: `src/components/tasks/TaskForm.tsx`
- Modify: `src/components/projects/ProjectForm.tsx`

**Step 1: In both files — replace hook import**

```typescript
// Remove:
import { useClients } from '@/hooks/use-clients'

// Add:
import { useContracts } from '@/hooks/use-contracts'
```

**Step 2: Replace hook call and update dropdown data source**

```typescript
// Remove:
const { data: clients = [] } = useClients()

// Add:
const { data: contracts = [] } = useContracts()
```

**Step 3: Update the dropdown options**

The `useContracts` query selects `*, wpa_businesses(name, ...)` — the business name will be in `contract.wpa_businesses.name`. Update the select options to read from that path, or adjust the query to alias the name. Example:

```typescript
// In the dropdown:
{contracts.map(c => (
  <SelectItem key={c.id} value={String(c.id)}>
    {(c as any).wpa_businesses?.name ?? c.business_id}
  </SelectItem>
))}
```

If TypeScript complains about the join shape, update the `Contract` interface in `use-contracts.ts` to include `wpa_businesses?: { name: string }`.

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/tasks/TaskForm.tsx src/components/projects/ProjectForm.tsx
git commit -m "feat(ui): task and project forms use contracts for client dropdown"
```

---

### Task 18: Update `src/components/leads/LeadDetail.tsx`

Replace `BusinessCommLogWidget` with `ActivityFeed`.

**Files:**
- Modify: `src/components/leads/LeadDetail.tsx`

**Step 1: Replace import**

```typescript
// Remove:
import { BusinessCommLogWidget } from './BusinessCommLogWidget'

// Add:
import { ActivityFeed } from '@/components/shared/ActivityFeed'
```

**Step 2: Replace usage** (line ~355)

```typescript
// Remove:
<BusinessCommLogWidget businessId={business.id} />

// Add:
<ActivityFeed businessId={business.id} />
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/leads/LeadDetail.tsx
git commit -m "feat(ui): LeadDetail uses unified ActivityFeed"
```

---

## Phase 4 — Cleanup and Verification

### Task 19: Delete orphaned files

**Step 1: Confirm no remaining imports**

```bash
grep -rn "use-client-activity\|use-business-activity\|use-clients\|CommLogWidget\|BusinessCommLogWidget" src/ --include="*.ts" --include="*.tsx"
```

Expected: zero results.

**Step 2: Delete the files**

```bash
rm src/hooks/use-client-activity.ts
rm src/hooks/use-business-activity.ts
rm src/hooks/use-clients.ts
rm src/components/clients/CommLogWidget.tsx
rm src/components/leads/BusinessCommLogWidget.tsx
```

**Step 3: TypeScript check — must be clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete legacy activity hooks and comm log widgets"
```

---

### Task 20: Run dev server and verify visually

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Check Chrome console for errors**

```bash
cd ~/WhitePineTech/Tools/mcp-servers
npx tsx run.ts chrome:console '{"url":"http://localhost:5173"}'
```

Expected: no errors.

**Step 3: Verify golden paths**
- Navigate to a Lead → confirm ActivityFeed loads and a new log entry can be submitted
- Navigate to a Client → confirm ActivityFeed loads (shows same history from unified table)
- Click "Convert to Client" on a lead → confirm RPC fires, lead disappears from leads view, appears in clients
- Open a client record → confirm contacts show (no broken `client_id` references)
- Open a task form → confirm client dropdown populates from contracts

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify account spine refactor end-to-end"
```

---

## Appendix: Key File Map

| Old | New | Notes |
|-----|-----|-------|
| `wpa_clients` table | `wpa_contracts` table | Data migrated, table dropped |
| `wpa_client_activity` table | `wpa_activity` table | Combined with wpa_business_activity |
| `wpa_business_activity` table | `wpa_activity` table | Merged, dropped |
| `use-clients.ts` | `use-contracts.ts` | Renamed types: Client→Contract |
| `use-client-activity.ts` | `use-activity.ts` | Unified on business_id |
| `use-business-activity.ts` | `use-activity.ts` | Unified on business_id |
| `CommLogWidget.tsx` | `ActivityFeed.tsx` | prop: clientId → businessId |
| `BusinessCommLogWidget.tsx` | `ActivityFeed.tsx` | Same component |
| `useConvertToClient` | Calls `convert_to_client()` RPC | Atomic, Hermes-reachable |
| `useAddClientActivity` / `useAddBusinessActivity` | `useAddActivity` calls `append_activity()` RPC | Atomic, Hermes-reachable |
