# Plan: Migrate command-center to Standalone Repo

**Date:** 2026-03-04
**Repo:** cpbjr/command-center (already created)

---

## Context

`/home/cpbjr/WhitePineAgency/Sites/command-center/` has grown into a full internal CRM/dashboard
for White Pine Agency. It has become substantial enough to warrant:
1. Its own git repo (currently buried in the WhitePineAgency monorepo)
2. Its own CI/CD pipeline
3. Its own Supabase migrations (currently in the parent monorepo's `supabase/`)
4. Eventually: a dedicated `wpa` schema instead of sharing `public` with TurfSheet

This plan covers **Phase 1: Repo Migration**. Schema migration is Phase 2 (separate task).

---

## Phase 1: Repo Migration

### Step 1 — Push code to new repo

The new repo `cpbjr/command-center` already exists. command-center has no separate git
history (tracked under WhitePineAgency monorepo), so we do a fresh init:

```bash
cd /home/cpbjr/WhitePineAgency/Sites/command-center
git init
git remote add origin git@github.com:cpbjr/command-center.git
git add .
git commit -m "chore: initial commit - migrate from WhitePineAgency monorepo"
git branch -M main
git push -u origin main
```

The monorepo history stays in WhitePineAgency. The new repo starts fresh.

---

### Step 2 — Move Supabase migrations

**Rationale:** Best practice is to co-locate migrations with the app that owns those tables.
command-center is the sole owner of all `wpa_*` tables.

**Files to move from WhitePineAgency/supabase/migrations/:**
- All `wpa_*` migration files (clients, contacts, tasks, projects, project_updates, documents, tags, etc.)
- Any migration that creates/alters WPA-specific tables

**Files to LEAVE in WhitePineAgency/supabase/:**
- TurfSheet-related migrations (they belong to that context)
- Any shared infrastructure migrations

**Target structure:**
```
command-center/
└── supabase/
    ├── config.toml   (copy + trim to WPA-only schemas)
    └── migrations/
        └── <all wpa migrations>
```

Copy the relevant migrations, create a new `config.toml` pointing to the same
Supabase project (`klyzdnocgrvassppripi`).

---

### Step 3 — Set up GitHub Actions CI/CD

Create `.github/workflows/deploy.yml` in the new repo.

Reference the existing WhitePineAgency deploy.yml for the SSH/rsync pattern, then replicate:

```yaml
name: Deploy Command Center

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy to beefy
        run: |
          rsync -avz --delete dist/ wpauser@5.78.152.85:/var/www/dashboard/
        env:
          SSH_KEY: ${{ secrets.BEEFY_SSH_KEY }}
```

**GitHub Secrets to add to cpbjr/command-center:**
- `BEEFY_SSH_KEY` — SSH private key for `wpauser@beefy`
- `VITE_SUPABASE_URL` — `https://klyzdnocgrvassppripi.supabase.co`
- `VITE_SUPABASE_ANON_KEY` — from current `.env`

---

### Step 4 — Remove command-center from WhitePineAgency monorepo

1. Remove the `command-center` job from `WhitePineAgency/.github/workflows/deploy.yml`
2. Delete or archive `WhitePineAgency/Sites/command-center/` (or leave as a placeholder README)
3. Remove WPA-specific migrations from `WhitePineAgency/supabase/migrations/`
   (only after confirming they've been committed to the new repo)

---

### Step 5 — Create CLAUDE.md in new repo

`.agent/README.md` and `.agent/System/deployment.md` already exist (created by prior agent).
Tasks live in Supabase (`wpa_tasks`), not markdown files.

Still needed: `CLAUDE.md` at repo root with:
- Supabase project ref (`klyzdnocgrvassppripi`)
- MCP project name (`white-pine-projects`)
- Pointer to `.agent/README.md`
- Deploy target info

---

## Phase 2: Schema Migration (Separate Task)

**Goal:** Move all `wpa_*` tables from `public` schema to a dedicated `wpa` schema.

**Why not `public`:** Anti-pattern for shared Supabase instances. `public` is exposed by
default to all consumers. A `wpa` schema provides clear ownership and avoids naming collisions.

**High-level approach:**
1. Create `wpa` schema in Supabase
2. Write migration to move each `wpa_*` table into `wpa` schema
3. Update all RLS policies to reference `wpa.*`
4. Update `supabase/config.toml` to expose `wpa` schema in API schemas list
5. Update all `src/` Supabase queries to use schema prefix
6. Update MCP-as-code config.json to point `white-pine-projects` at `wpa` schema

**This is a breaking change** — do it on a feature branch, test fully before merging.

---

## Files Affected (Phase 1)

| File | Action |
|------|--------|
| `WhitePineAgency/Sites/command-center/**` | Move to new repo |
| `WhitePineAgency/supabase/migrations/wpa_*` | Move to `command-center/supabase/migrations/` |
| `WhitePineAgency/.github/workflows/deploy.yml` | Remove command-center job |
| `command-center/.github/workflows/deploy.yml` | Create new |
| `command-center/CLAUDE.md` | Create with Supabase config |
| `command-center/.agent/README.md` | Already exists |
| `command-center/.agent/System/deployment.md` | Already exists |

---

## Verification

1. `npm run dev` works locally from new repo location
2. Push to `main` triggers GitHub Actions deploy
3. `/var/www/dashboard/` on beefy is updated
4. App loads at dashboard.whitepineagency.com without errors
5. Supabase queries still work (same project ref, same anon key)
6. WhitePineAgency monorepo CI/CD still deploys other sites correctly
