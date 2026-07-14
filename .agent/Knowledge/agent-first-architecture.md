# Knowledge — Agent-First Architecture Decisions (2026-07)

Insights recorded during the agent-first refactor (Phase 1). Context for future sessions.

## How Christopher works

- One-person agency; the dashboard is a **review/steer surface**, not a data-entry tool. The DB is the API between him, the UI, and the agent.
- One agent going forward: **Bob** (Robert) — Hermes-based, on the VPS. "OC Bob" (OpenClaw) is retired; "Bud" was the same agent's discovery persona and has been renamed to Bob in the UI. Use `'bob'` as the actor/assignee identifier everywhere.
- Delegation model: **explicit → autonomous ramp.** Start with explicit assignment (`assigned_to='bob'`) and full audit trail; grow toward standing rules and agent-proposed tasks (Phase 3) as trust builds. Predictability and auditability beat cleverness.
- Prefers "simple but powerful": no separate deals table, no rule engine in the DB — natural-language rules interpreted by the agent, small schema additions over new subsystems.
- Wants email eventually: Bob captures threads from the whitepineagency.com mailbox into `wpa_activity` and drafts outbound as proposals — agent-mediated, no frontend email infrastructure. Deferred, not dropped.

## Load-bearing design decisions

- **`lifecycle_stage` is the authoritative pipeline field**; `contact_status` is a legacy mirror kept in sync by the `trg_a_sync_pipeline` DB trigger until the UI migrates (Phase 2), then both column and trigger get dropped. Never write logic against `contact_status` in new code.
- **Task history is append-only** (`wpa_task_events`); `wpa_tasks.notes` is human scratch space the agent must not overwrite.
- **`review` status is the human inbox**: agent work terminates there, not at `done`.
- **Every `wpa` table bumps `updated_at` via trigger** — change polling (`updated_at=gt.X`) is now reliable; don't manually set `updated_at` in hooks.
- **Actor attribution**: `wpa_activity.actor` and `wpa_task_events.actor` ∈ {'human','bob'}. RPCs default `p_actor` to `'bob'` (agents are the main RPC callers); the UI passes `'human'` explicitly.
- The dashboard **dual-writes the `bobwork` tag** while `assigned_to='bob'` — a transition shim for Bob's live skill. Remove it (TaskForm.tsx) once the skill reads `assigned_to`.
- Planned move to a **dedicated Supabase project** with authenticated-only RLS: see `.agent/Tasks/Implementation/2026-07-13-new-supabase-cutover.md`. Until then the anon key is god-mode on a shared project — treat it as such.

## Known debt (Phase 2/3 backlog)

- No generated Supabase types; ~9 `as any` casts; duplicated row/join types across hooks.
- `client_id == contract_id` assumption on GBP tables (FKs dropped) — restore real FKs.
- Over-fetching: `useBusinessesSimple` pages all ~1,900 businesses for a combobox; ClientBoard fetches all tasks for counts; DiscoveryPage double-fetches.
- Duplicated components: ScoreBar/ScoreBadge, LeadTaskList/ClientTaskList; duplicated PRIORITY_ORDER.
- CRM gaps: no next_action_date/Today view, no deal-value fields on leads, activity not linkable to contacts, notes fragmented across three places.
