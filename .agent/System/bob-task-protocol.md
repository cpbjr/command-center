# Bob — Task Protocol (v2)

How the Bob agent (Hermes-based, on the VPS) works the Command Center task queue. This is the contract between the dashboard and the agent; the skill file on the VPS (`/home/wpauser/.hermes/hermes-agent/skills/wpa-pipeline/SKILL.md`) should implement exactly this.

## Picking up work

```
GET /rest/v1/wpa_tasks?assigned_to=eq.bob&status=in.(todo,in_progress,blocked)&order=priority.asc
```

Headers: `Accept-Profile: wpa` (and `Content-Profile: wpa` on writes), plus the Supabase key. On the new dedicated project this is the **service-role key** (VPS-only); until cutover, the anon key.

Optional but polite: PATCH `{"status": "in_progress"}` when starting, so the board shows live state.

## Reporting progress and results

Task history is **append-only** in `wpa_task_events`. Never overwrite `wpa_tasks.notes`.

```
POST /rest/v1/wpa_task_events
{ "task_id": <id>, "actor": "bob", "kind": "agent_run", "body": "<what was done, outcomes, links>" }
```

Use `kind: "comment"` for questions/updates addressed to Christopher; he sees them in the task's Activity feed and can reply the same way (his rows have `actor: "human"`).

## Finishing

```
PATCH /rest/v1/wpa_tasks?id=eq.<id>
{ "status": "review" }
```

`review` is the owner's inbox — Christopher reviews and closes to `done`. Only set `done` directly if the task explicitly says so. If stuck, set `{"status": "blocked"}` and POST a `comment` event explaining why.

## Business-level actions

Use the RPCs (all take optional trailing `p_actor TEXT DEFAULT 'bob'`, so Bob can omit it):

- `POST /rest/v1/rpc/append_activity` — `{p_business_id, p_type, p_summary, p_occurred_at?}` for any touch: call, email, meeting, text, action, note.
- `POST /rest/v1/rpc/move_to_stage` — `{p_business_id, p_stage}` (stage ∈ identified/new/prospect/qualified/proposal/lead/client/churned). Logs the stage change and syncs the legacy `contact_status` mirror automatically.
- `POST /rest/v1/rpc/convert_to_client` — `{p_business_id, p_service_tier, p_monthly_revenue?}`.

## Change polling

Every `wpa` table now bumps `updated_at` on any UPDATE (DB trigger), so `?updated_at=gt.<last-seen>` is reliable for "what changed since my last run".

## Legacy protocol (retire after skill cutover)

The old queue query `?tags=cs.{bobwork}&status=neq.done` still works — the dashboard dual-writes the `bobwork` tag while `assigned_to='bob'`. Once the skill uses `assigned_to`, tell Claude Code to remove the dual-write in `src/components/tasks/TaskForm.tsx`.
