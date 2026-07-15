# Command Center — Domain Language

## Core Entities

**Business (Account)**
The durable entity. A real-world company or person we have any relationship with. Never deleted. Exists from the moment first recorded. All contacts, activity, and contracts hang off the Business. `lifecycle_stage` tracks the current relationship status.

**Lead**
A Business in a pre-client lifecycle stage (`identified`, `new_prospect`, or `lead`). A business we are pursuing but have not yet signed. No separate record — the Business row is the lead.

**Client**
A lifecycle stage on a Business (`lifecycle_stage = 'client'`), plus a `wpa_contracts` row recording the signed engagement. The contract is the paper trail; the stage is the current status.

**Dropped**
A terminal lifecycle stage on a Business (`lifecycle_stage = 'dropped'`) for a **lead that never became a client** — either party walked, or it wasn't a fit. Distinct from `relationship_ended`, which is for former *clients*. The Business row is retained (never deleted) and can be revived back into the pipeline. Optional `dropped_reason` on `wpa_businesses`: `declined | not_a_fit | no_response`.

**Relationship Ended**
A terminal lifecycle stage on a Business (`lifecycle_stage = 'relationship_ended'`) for a **former client** — the engagement is over. Replaces the old `churned` (which wrongly implied the client lapsed; this covers all endings). The *reason* lives on the contract, not the stage: `wpa_contracts.close_reason` (`work_completed | parted_ways`) + `closed_at`. Contract rows are retained as history; re-engagement flips the stage back to `client` and adds a new contract row.

**Contact**
A person at a Business. Always belongs to a Business via `business_id`. Never belongs to a lead or client record directly — to the account. Contacts are unaffected by lifecycle stage changes.

**Contract**
A row in `wpa_contracts` recording a signed client engagement. One row per engagement. Supports re-engagement history. Created by the `convert_to_client()` RPC.

**Activity**
A row in `wpa_activity` recording any event on a Business account (stage changes, notes, calls, emails). Attached to `business_id`. Has an `actor` column (`'human'` or `'bob'`) identifying who logged it. Written by the `append_activity()` RPC or direct insert.

**Task**
A row in `wpa_tasks`. `assigned_to` is `'human'` or `'bob'` — Bob polls for his open tasks and works them. Task history (comments, agent runs) is append-only in `wpa_task_events`; `notes` is never overwritten by the agent.

**Bob**
The autonomous agent (Hermes-based, running on the VPS). Reads and writes this database over Supabase REST and the RPCs below. Formerly "OC Bob" (OpenClaw, retired) and "Bud" — one agent, one name now.

## Lifecycle Stages

`lifecycle_stage` is the authoritative pipeline field. Three pre-client stages, one active-client stage, and two terminals:

```
identified → new_prospect → lead → client
                  │           │        │
                  └───────────┴──► dropped        (lead ended, never a client)
                                    client ──► relationship_ended   (former client)
                                                       ↑ (re-engagement → client)
```

- **`identified`** — Bob discovered it; unreviewed.
- **`new_prospect`** — reviewed and accepted into the pipeline; actively pursuing.
- **`lead`** — hot; engaged, pre-signature.
- **`client`** — active client (reached only via the `convert_to_client` flow, which writes the contract).
- **`dropped`** — terminal; a lead that ended before becoming a client. Revivable. See **Dropped** entity.
- **`relationship_ended`** — terminal; a former client. See **Relationship Ended** entity.

Manually selectable in the Leads UI: `identified`, `new_prospect`, `lead`, `dropped`. `client` is reached via **Convert to Client**; `relationship_ended` via **End Engagement** (both set companion contract fields, so neither is a bare dropdown pick).

## Task Statuses

`todo → in_progress → review → done` (plus `blocked`). Bob finishes work into **review**; the owner reviews and closes to done.

## Key RPCs

All take an optional trailing `p_actor TEXT DEFAULT 'bob'` — the UI passes `'human'`, agents can omit it.

**`convert_to_client(p_business_id, p_service_tier, p_monthly_revenue, p_actor)`**
Atomically: sets `lifecycle_stage = 'client'`, inserts a `wpa_contracts` row, logs a stage-change activity entry.

**`move_to_stage(p_business_id, p_stage, p_actor)`**
Moves a business to a lifecycle stage and logs a stage-change activity entry.

**`end_engagement(p_business_id, p_close_reason, p_actor)`**
Ends an active client engagement: sets `lifecycle_stage = 'relationship_ended'`, stamps `close_reason` + `closed_at` on the business's current `wpa_contracts` row, and logs a stage-change activity entry. The client-side mirror of `convert_to_client`.

**`append_activity(p_business_id, p_type, p_summary, p_occurred_at, p_actor)`**
Unified activity writer. Used by both the Command Center UI and Bob.
