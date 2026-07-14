# Command Center — Agent README

## What This Is

The White Pine Agency Command Center is an internal operations dashboard built for a one-person local SEO and web dev agency. It is the single source of truth for tasks, clients, projects, leads, and business data.

It is **not** a general-purpose CRM or project management tool. It is purpose-built for managing a small agency's operations — with direct integration to a Supabase database that also powers an autonomous AI agent (OC Bob) running nightly research and task execution.

This repo is public because there wasn't much like it on GitHub. If you're running a small agency or side business with AI agents in the mix, this may be useful as a reference.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Data fetching | TanStack Query (React Query) |
| Backend | Supabase (PostgreSQL + REST API) |
| Deployment | Static build → rsync to VPS via GitHub Actions CI |

---

## Key Pages

| Page | Purpose |
|------|---------|
| Tasks | Central task queue — all work tracked here |
| Projects | Group tasks by project, track activity |
| Clients | Active clients with linked tasks/projects |
| Leads | Lead pipeline — businesses being pursued |
| Discovery | Browse the business database (2,100+ local businesses) |
| Docs | Internal documents and reference materials |

---

## Database

Supabase project: `klyzdnocgrvassppripi`

Key tables (all in the `wpa` schema):
- `wpa_tasks` — all tasks (status, priority, category, `assigned_to`, tags, notes)
- `wpa_task_events` — append-only task history (comments, agent runs) with actor attribution
- `wpa_projects` — projects with linked tasks and activity log
- `wpa_businesses` — the account spine: every lead, client, and prospect (`lifecycle_stage` is the pipeline field)
- `wpa_contracts` — signed client engagements (one row per engagement)
- `wpa_contacts` — people at businesses
- `wpa_activity` — unified per-business activity log (calls, emails, notes, stage changes) with `actor`
- `wpa_documents` — internal docs

The `assigned_to` column on `wpa_tasks` powers the agent work queue: tasks assigned to `bob` are picked up by the Bob agent via REST API. (The legacy `bobwork` tag is dual-written during the transition; see below.)

---

## Autonomous Agent Integration

Bob (a Hermes-based agent running on the VPS; successor to OC Bob/OpenClaw) reads and executes tasks from this database:

```
GET /rest/v1/wpa_tasks?assigned_to=eq.bob&status=in.(todo,in_progress,blocked)&order=priority.asc
```

While working a task, Bob may append progress events:
```
POST /rest/v1/wpa_task_events
{ "task_id": <id>, "actor": "bob", "kind": "agent_run", "body": "<what was done and outcomes>" }
```

After completing a task, Bob PATCHes it into the review inbox (the owner closes it to `done`):
```json
{ "status": "review" }
```

Do NOT overwrite `wpa_tasks.notes` — task history belongs in `wpa_task_events`.

Business-level actions go through the RPCs (`append_activity`, `move_to_stage`, `convert_to_client`), each of which takes an optional trailing `p_actor` that defaults to `'bob'`. See `CONTEXT.md` for signatures.

Claude Code (in interactive sessions) uses the same protocol.

**Transition note:** the old protocol (`tags=cs.{bobwork}`, PATCH `{status:'done', notes:...}`) still works — the UI dual-writes the `bobwork` tag while `assigned_to='bob'` — but should be migrated in Bob's skill file, after which the tag dual-write can be removed.

---

## Project Structure

```
src/
├── components/       # UI components by domain
│   ├── tasks/        # TaskForm, task list items
│   ├── projects/     # ProjectDetail, ProjectForm
│   ├── clients/      # Client views
│   ├── leads/        # Lead pipeline
│   ├── discovery/    # Business browser
│   └── layout/       # App shell, nav
├── hooks/            # React Query hooks (use-tasks, use-projects, etc.)
├── pages/            # Page-level components
└── lib/              # Supabase client, formatters
```

Database migrations live in `supabase/migrations/`.

---

## Getting Started

```bash
npm install
cp .env.example .env   # Add your Supabase URL and anon key
npm run dev
```

Requires a Supabase project. Schema is in `supabase/migrations/` — apply with:
```bash
npx supabase@latest link --project-ref <your-ref>
npx supabase@latest db push
```

---

## Deployment

See [.agent/System/deployment.md](.agent/System/deployment.md) for the full deployment setup (CI workflow, VPS target, rsync process).

---

## Contributing / Context for AI Agents

- Read this file first
- Check `.agent/System/` for deployment and schema details
- Task tracking lives in the database, not in markdown files
- The Supabase anon key is in `.env` (not committed) — use it for REST API calls
