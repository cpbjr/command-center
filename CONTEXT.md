# Command Center — Domain Language

## Core Entities

**Business (Account)**
The durable entity. A real-world company or person we have any relationship with. Never deleted. Exists from the moment first recorded. All contacts, activity, and contracts hang off the Business. `lifecycle_stage` tracks the current relationship status.

**Lead**
A lifecycle stage on a Business (`lifecycle_stage = 'lead'`). A business we are actively pursuing but have not yet signed. No separate record — the Business row is the lead.

**Client**
A lifecycle stage on a Business (`lifecycle_stage = 'client'`), plus a `wpa_contracts` row recording the signed engagement. The contract is the paper trail; the stage is the current status.

**Churned**
A lifecycle stage on a Business (`lifecycle_stage = 'churned'`). A former client. Contract rows are retained as history. Re-engagement flips the stage back to `client` and adds a new contract row.

**Contact**
A person at a Business. Always belongs to a Business via `business_id`. Never belongs to a lead or client record directly — to the account. Contacts are unaffected by lifecycle stage changes.

**Contract**
A row in `wpa_contracts` recording a signed client engagement. One row per engagement. Supports re-engagement history. Created by the `convert_to_client()` RPC.

**Activity**
A row in `wpa_activity` recording any event on a Business account (stage changes, notes, calls, tasks). Attached to `business_id`. Written by the `append_activity()` RPC.

## Lifecycle Stages

```
lead → client → churned → client (re-engagement)
```

## Key RPCs

**`convert_to_client(business_id)`**
Atomically: sets `lifecycle_stage = 'client'`, inserts a `wpa_contracts` row, logs a stage-change activity entry.

**`append_activity(business_id, type, note, actor)`**
Unified activity writer. Used by both the Command Center UI and Hermes agent.
