# Plan: Migrate command-center to Standalone Repo

**Date:** 2026-03-04
**Completed:** 2026-03-04
**Repo:** cpbjr/command-center
**Status:** ✅ Complete

---

## Context

`/home/cpbjr/WhitePineAgency/Sites/command-center/` had grown into a full internal CRM/dashboard
for White Pine Agency and was migrated to its own standalone repo for cleaner separation.

---

## What Was Done

### Step 1 — git init + push to cpbjr/command-center ✅
- Fresh `git init` in `Sites/command-center/`
- Added `.env` and `.vite/` to `.gitignore` before first commit
- Pushed 87 files as initial commit to `cpbjr/command-center`

### Step 2 — Supabase migrations copied ✅
- Created `supabase/migrations/` in the new repo
- Copied 26 WPA-specific migration files (everything from `20260223` onward, excluding Atomic CRM seed)
- Created `supabase/config.toml` pointing to project ref `klyzdnocgrvassppripi`

### Step 3 — GitHub Actions CI/CD created ✅
- Created `.github/workflows/deploy.yml` using `burnett01/rsync-deployments@7.0.1` (matching monorepo pattern)
- Targets `wpauser@5.78.152.85:/var/www/dashboard/`
- All 5 secrets set via `gh` CLI: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- First successful deploy confirmed ✅

### Step 4 — Monorepo cleanup ✅
- Removed `deploy-command-center` job from `WhitePineAgency/.github/workflows/deploy.yml`
- Committed and pushed that change (`d4f4f4d`)
- Deleted `WhitePineAgency/Sites/command-center/` directory

### Step 5 — CLAUDE.md created ✅
- Created `CLAUDE.md` at repo root with Supabase config, MCP project name, deploy info, and folder structure

### Step 6 — .agent/ committed ✅
- `.agent/README.md` and `.agent/System/deployment.md` (created by prior agent) committed to new repo
- This implementation plan committed to `.agent/Tasks/Implementation/`

### Step 7 — Files moved to canonical location ✅
- All files copied from `~/WhitePineAgency/Sites/command-center/` to `~/WhitePineTech/Projects/CommandCenter/`
- Git remote intact: `git@github.com:cpbjr/command-center.git`

---

## Final State

| Item | Value |
|------|-------|
| Repo | `cpbjr/command-center` |
| Local path | `~/WhitePineTech/Projects/CommandCenter/` |
| Live URL | `https://dashboard.whitepineagency.com` |
| Deploy target | `wpauser@5.78.152.85:/var/www/dashboard/` |
| Supabase project | `klyzdnocgrvassppripi` |
| Schema | `public` (Phase 2: migrate to `wpa` schema — separate task) |

---

## Phase 2 (Future Task)

Move all `wpa_*` tables from `public` schema to a dedicated `wpa` schema:
1. Create `wpa` schema in Supabase
2. Write migration to move each `wpa_*` table
3. Update RLS policies
4. Update `supabase/config.toml` API schemas list
5. Update all `src/` Supabase queries to use schema prefix
6. Update MCP-as-code config.json (`white-pine-projects` → `wpa` schema)

**Note:** Breaking change — do on a feature branch, test fully before merging.
