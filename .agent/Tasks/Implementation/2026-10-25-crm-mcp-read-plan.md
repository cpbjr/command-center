# CRM MCP read implementation plan

**Date:** 2026-10-25
**Repo:** `/home/wpauser/src/command-center`
**Branch:** `feature/crm-mcp-read`
**Planner:** Oscar
**Implementer:** Cody
**Reviewer:** Ricky
**Status:** ready

**Goal:** A read-only HTTP MCP for Command Center, same token shape as the budget MCP.

**Done when:**

- [ ] `mcp_crm/.venv/bin/python -m pytest tests/test_mcp_crm.py -q` is green
- [ ] The fail run was red first because `mcp_crm` was missing
- [ ] No write tool is registered
- [ ] Tests use a fake book and make zero live Supabase calls
- [ ] Ricky read the diff and signed off
- [ ] `.agent/Tasks/active.md` still names this job

**Out of scope:**

- Creates, updates, stage moves, archive, deal tools
- `db push`, Caddy, deploy, minting a live token
- The React app under `src/`
- expense-tracker

---

## Context (read first)

- This file only
- Pattern, open only if needed: `/home/wpauser/src/expense-tracker/expense-tracker-bot/mcp_budget/server.py`
- Pattern, open only if needed: `/home/wpauser/src/expense-tracker/expense-tracker-bot/mcp_budget/tokens.py`
- Pattern, open only if needed: `/home/wpauser/src/expense-tracker/expense-tracker-bot/mcp_budget/cli.py`
- Pattern, open only if needed: `/home/wpauser/src/expense-tracker/supabase/migrations/20261024120000_expense_mcp_api_tokens.sql`

Do not search this repo. Do not read the tree.

**Current state:** Command Center is a Vite app. It has no MCP package. Live book is Supabase project `cfwaefobqjouyglocuyh`, schema `wpa`. REST answered HTTP 200 on 2026-10-25.

**Change:** A Python package `mcp_crm` with seven read tools, a revocable bearer, and an unapplied token-table migration.

---

## Records

- Company is `wpa.wpa_businesses`. Id is text. Stage column is `lifecycle_stage`. Values are identified, new_prospect, lead, client, dropped, relationship_ended. No owner column. No tags column. No email column. Phone is `phone`. Site is `website_url`.
- Contact is `wpa.wpa_contacts`. Id is bigint. Link is `business_id`. Name fields are `name` and `last_name`.
- Contact notes are `wpa.wpa_contact_notes`. Body is `body`. They are not `wpa_activity`.
- Activity is `wpa.wpa_activity`. Link is `business_id`. Text is `summary`. Actor is `actor`.
- Task is `wpa.wpa_tasks`. Link is `business_id`. Owner filter is `assigned_to`. Tags are `tags`. Due is `due_date`.
- There is no deals table. Do not add deal tools.

---

## Tools

Each result is JSON with an id and a short `message`.

1. `search(query, type?)` finds a business by name or phone, or a contact by name, email, or phone. `type` is `business` or `contact`. Omit it and search both.
2. `get_business(id)` returns the business plus its contacts, activity, and tasks.
3. `get_contact(id)` returns the contact plus `wpa_contact_notes`.
4. `list_businesses(stage?, limit?)` filters on `lifecycle_stage` only.
5. `list_contacts(business_id?, limit?)`
6. `list_tasks(status?, assigned_to?, business_id?, due_from?, due_to?, tag?, limit?)`
7. `list_activity(business_id)` reads `wpa_activity` only.

Default limit is 25. Cap is 50. A business id stays text. A contact id stays a number.

Scope is `crm:read`. Public URL string in tests is `https://whitepine-tech.com/crm/mcp`. Token prefix is `crm_`. Subject is text. The live subject will be Discord user `1500630701589008444`. Do not cast it to uuid. Tests use `MemoryTokenStore`. CLI mint and revoke exist. Only the hash is stored.

---

## Files

- Create: `mcp_crm/__init__.py`
- Create: `mcp_crm/__main__.py`
- Create: `mcp_crm/server.py`
- Create: `mcp_crm/reader.py`
- Create: `mcp_crm/tokens.py`
- Create: `mcp_crm/cli.py`
- Create: `mcp_crm/requirements.txt` with `mcp==2.3.0` and `pytest>=9.0.0`
- Create: `tests/test_mcp_crm.py`
- Create: `supabase/migrations/20261025120000_wpa_mcp_api_tokens.sql`
- Modify: `.gitignore` so `mcp_crm/.venv/` and `__pycache__/` are ignored
- Do not touch: `src/`
- Do not touch: `/home/wpauser/src/expense-tracker`

Token table is `wpa.mcp_api_tokens`. Columns match the budget table except `user_id` is TEXT, not UUID. RLS on. No policies. Nothing in `public`. Nothing in `bookkeeping`. Do not apply the migration.

---

## Steps

### 1. Fail test

**Files:** `tests/test_mcp_crm.py`

**Do:** Write the test first. Create the venv. Run the command. It must fail because `mcp_crm` is missing.

**Verify:**

```bash
python3 -m venv mcp_crm/.venv
mcp_crm/.venv/bin/pip install -r mcp_crm/requirements.txt
mcp_crm/.venv/bin/python -m pytest tests/test_mcp_crm.py -q
```

Expected: fail. Paste that output.

### 2. Implement

**Files:** `mcp_crm/*` and the migration

**Do:** Add the read server, the memory token store, the CLI, and the unapplied migration. No write tools. No live Supabase client in the test path.

**Verify:** same pytest command, green. Paste that output.

---

## Tests

**Command:** `mcp_crm/.venv/bin/python -m pytest tests/test_mcp_crm.py -q`

The suite must prove 401 with no bearer, a revoked token fails, the seven read tools return id and message, and no write tool is registered. Fake book only.

**If no harness:** not this job. The suite above is the harness.

---

## Risks

- A live call would hit 1916 real businesses. Tests must not open the network.
- `db push` from this host is forbidden. Leave the SQL file unapplied.
- Do not commit, push, or deploy.

---

## Handoff

Implementer: follow this file. Do not expand scope. Do not search. Do not read the tree.
When the same command is green, stop and hand the diff for review.
Ship is a later word from Christopher. This cut does not make the bot live.
