# Command Center — Claude Code Config

## Project

White Pine Agency internal operations dashboard.

**Read `.agent/README.md` first** for full project context.

Be proactive. If the next step is obvious, do not stop to ask if it should be done. 

Add to .agent/Knowledge/ insights about how Christopher works and how the site functions. Your job is to maximize time spent on the projet by understanding it and how it is used. 

When planning, always consider what "best practices" are. Those should be your guiding principle. 

When creating plans always save a copy to .agent/Tasks/Implementation/. When work has been completed, document the work done and move the plan to .agent/Tasks/completed/. 
---

## Supabase

| Key | Value |
|-----|-------|
| Project ref | `klyzdnocgrvassppripi` |
| URL | `https://klyzdnocgrvassppripi.supabase.co` |
| Schema | `WPA` |
| MCP project name | `white-pine-projects` |

**Querying via MCP-as-code:**
```bash
cd ~/Documents/AI_Automation/Tools/mcp-servers
npx tsx run.ts supabase:query '{"project":"white-pine-projects","table":"wpa_tasks","limit":10}'
```

**Schema migrations** live in `supabase/migrations/`. Apply with:
```bash
npx supabase@latest link --project-ref klyzdnocgrvassppripi
npx supabase@latest db push
```
## ALWAYS USE "WPA" SCHEMA, NEVER "PUBLIC".

---

## Deployment

- **Target:** beefy (5.78.152.85), user `wpauser`
- **Web root:** `/var/www/dashboard/`
- **Live URL:** https://dashboard.whitepineagency.com
- **CI:** GitHub Actions on push to `main` — see `.github/workflows/deploy.yml`

See `.agent/System/deployment.md` for full deployment details.

---

## Dev

```bash
cp .env.example .env   # add Supabase URL + anon key
npm install
npm run dev
```

---

## Project Folder Structure

```
command-center/
├── src/
│   ├── components/     # UI by domain (tasks/, clients/, projects/, leads/, etc.)
│   ├── hooks/          # React Query hooks
│   ├── pages/          # Page-level components
│   └── lib/            # supabase.ts, utils.ts
├── supabase/
│   ├── config.toml
│   └── migrations/     # All WPA schema migrations
├── .agent/
│   ├── README.md
│   └── System/
│       └── deployment.md
└── .github/
    └── workflows/
        └── deploy.yml
```
