# CRM MCP live process

**Date:** 2026-10-26
**Repo:** `/home/wpauser/src/command-center`
**Branch:** `feature/crm-mcp-live`
**Planner:** Oscar
**Implementer:** Cody
**Reviewer:** Ricky
**Status:** ready

**Goal:** The read-only MCP process starts and reads live Command Center rows through a fake-tested Supabase reader.

**Done when:**

- [ ] `mcp_crm/.venv/bin/python -m pytest tests/test_mcp_crm.py -q` is green
- [ ] The new test failed first because `mcp_crm.live` was missing
- [ ] No write tool is registered
- [ ] Tests make zero live Supabase calls
- [ ] Ricky read the diff and signed off

**Out of scope:**

- Caddy, docker up, `db push`, minting a token, commit, push
- Writes, deals, archive
- The React app under `src/`

---

## Context (read first)

- This file only
- `/home/wpauser/src/command-center/mcp_crm/__main__.py`
- `/home/wpauser/src/command-center/mcp_crm/reader.py`
- `/home/wpauser/src/command-center/mcp_crm/server.py`
- `/home/wpauser/src/expense-tracker/expense-tracker-bot/mcp_budget/__main__.py`

Do not search. Do not read the tree.

**Current state:** `__main__.py` prints that the cut is not live and returns 1. `CrmReader` only reads an in-memory book.

**Change:** A live reader over schema `wpa`, and a process entry that starts uvicorn.

---

## Live reader

Create `mcp_crm/live.py`. Class `SupabaseCrmReader`. It takes a client already scoped to schema `wpa`. Same method names as `CrmReader`.

Do not load the whole book. Query the rows the call needs.

- `search` uses `ilike` on business name or phone, and contact name, last_name, email, or phone.
- `get_business` loads that business plus its contacts, activity, and tasks. Do not select `raw_data`.
- `get_contact` loads that contact plus `wpa_contact_notes`.
- `list_businesses` filters `lifecycle_stage` only.
- `list_contacts` filters `business_id`.
- `list_tasks` filters status, assigned_to, business_id, due range, and tag.
- `list_activity` filters `business_id` and orders by `occurred_at` desc.

Limit default 25. Cap 50. Business id stays text. Contact id stays a number. Each result has `id` and `message`.

---

## Process

Replace the stub in `mcp_crm/__main__.py`.

- Public URL default `https://whitepine-tech.com/crm/mcp`
- Bind `0.0.0.0`. Port from `MCP_PORT`, default 8000.
- Client uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, schema `wpa`.
- Token store is `SupabaseTokenStore`. If both `MCP_API_TOKEN` and `MCP_USER_ID` are set, also accept that static token. If only one is set, exit. `MCP_USER_ID` stays text.
- Call `uvicorn.run`. Do not print the old not-live line.

Add `GET /health` on the app. Body `{"status":"ok"}`.

Add `supabase` and `uvicorn` to `mcp_crm/requirements.txt`. Keep `mcp==2.3.0`.

Add `mcp_crm/Dockerfile`. Base `python:3.12-slim`. Install the requirements. Command `python -m mcp_crm`.

---

## Tests

Add tests in `tests/test_mcp_crm.py`. Use a fake client. No network.

The new test must fail on current code because `mcp_crm.live` does not exist.

**Command:** `mcp_crm/.venv/bin/python -m pytest tests/test_mcp_crm.py -q`

---

## Handoff

Do not commit. Do not push. Do not call live Supabase. Do not apply the migration.
