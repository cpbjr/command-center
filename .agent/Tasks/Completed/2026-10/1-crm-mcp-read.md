# Task 1 - CRM MCP read

**Completed**: 2026-10-28

## What Was Done

The read-only CRM MCP is live at `https://whitepine-tech.com/crm/mcp`. A call with no token returns 401. Selects use `lifecycle_stage`. They do not ask for `contact_status` or `client_id`.

## Key Changes

- Seven read tools are on main and in the running process.
- The process runs as `command-center-mcp` on whitepine. The dashboard rsync does not start it.
- `wpa.mcp_api_tokens` is live. Agent bearers stay available. Revoke was not asked.

## Notes

The token table was applied on company Supabase `cfwaefobqjouyglocuyh`. Do not apply it again.
