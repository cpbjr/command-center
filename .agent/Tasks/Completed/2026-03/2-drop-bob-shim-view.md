# Task 2 - Drop OC Bob Shim View ✅

**Completed**: 2026-03-05

## What Was Done
Removed the backward-compatibility shim view (`public.wpa_tasks`) now that OC Bob queries the `wpa` schema directly via `Accept-Profile: wpa` header. The wpa schema migration is now fully clean with no legacy workarounds.

## Key Changes
- Dropped `public.wpa_tasks` shim view via migration
- OC Bob updated to use `Accept-Profile: wpa` header on REST API calls
- Verified: requests with header return data, requests without correctly fail

## Notes
- This completes the full public→wpa schema migration started in Task 1
- Other tables in `public` (contacts, deals, companies, etc.) belong to other projects and were left untouched
