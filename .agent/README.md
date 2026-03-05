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

Key tables:
- `wpa_tasks` — all tasks (status, priority, category, tags, notes)
- `wpa_projects` — projects with linked tasks and activity log
- `wpa_clients` — active clients
- `businesses` — lead/prospect database
- `wpa_documents` — internal docs

The `tags TEXT[]` column on `wpa_tasks` powers the autonomous agent work queue. Tasks tagged `bobwork` are picked up by OC Bob via REST API.

---

## Autonomous Agent Integration

OC Bob (an OpenClaw agent running on a Hetzner VPS) reads and executes tasks from this database:

```
GET /rest/v1/wpa_tasks?tags=cs.{bobwork}&status=neq.done&order=priority.asc
```

After completing a task, Bob PATCHes:
```json
{ "status": "done", "notes": "<what was done and outcomes>" }
```

Claude Code (in interactive sessions) uses the same protocol.

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
