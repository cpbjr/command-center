# Command Center — Domain Language

## Core Entities

**Business (Account)**
The durable entity. A real-world company or person we have any relationship with. Never deleted. Exists from the moment first recorded. All contacts, activity, and contracts hang off the Business. `lifecycle_stage` tracks the current relationship status.

**Lead**
A Business in a pre-client lifecycle stage (`identified` through `proposal`/`lead`). A business we are actively pursuing but have not yet signed. No separate record — the Business row is the lead.

**Client**
A lifecycle stage on a Business (`lifecycle_stage = 'client'`), plus a `wpa_contracts` row recording the signed engagement. The contract is the paper trail; the stage is the current status.

**Churned**
A lifecycle stage on a Business (`lifecycle_stage = 'churned'`). A former client. Contract rows are retained as history. Re-engagement flips the stage back to `client` and adds a new contract row.

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

`lifecycle_stage` is the authoritative pipeline field:

```
identified → new → prospect → qualified → proposal → lead → client → churned
                                                              ↑ (re-engagement)
```

The legacy `contact_status` column is a synced mirror maintained by a DB trigger (kept until the UI fully migrates), mapping:
IDENTIFIED↔identified, NEW↔new, TARGETED↔prospect, CONTACTED↔qualified, REPLIED↔proposal/lead, CLOSED-WON↔client, CLOSED↔churned.

## Task Statuses

`todo → in_progress → review → done` (plus `blocked`). Bob finishes work into **review**; the owner reviews and closes to done.

## Key RPCs

All take an optional trailing `p_actor TEXT DEFAULT 'bob'` — the UI passes `'human'`, agents can omit it.

**`convert_to_client(p_business_id, p_service_tier, p_monthly_revenue, p_actor)`**
Atomically: sets `lifecycle_stage = 'client'`, inserts a `wpa_contracts` row, logs a stage-change activity entry.

**`move_to_stage(p_business_id, p_stage, p_actor)`**
Moves a business to a lifecycle stage and logs a stage-change activity entry. The sync trigger mirrors the change into `contact_status`.

**`append_activity(p_business_id, p_type, p_summary, p_occurred_at, p_actor)`**
Unified activity writer. Used by both the Command Center UI and Bob.
