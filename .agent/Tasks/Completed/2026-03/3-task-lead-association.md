# Task 3 - Task/Lead Association ✅

**Completed**: 2026-03-06

## What Was Done
Tasks can now be associated with leads (businesses) via a dropdown in the task form, and when a lead converts to a client, all their tasks carry over automatically through the shared business_id link.

## Key Changes
- Added `business_id` column to `wpa_clients` table linking clients back to their original business/lead record
- Added Lead dropdown to TaskForm, mutually exclusive with Client selector
- Lead→Client conversion now stores `business_id` on the client record
- ClientTaskList fetches tasks by `business_id` for converted clients, falls back to `client_id` for legacy clients

## Notes
- Existing clients (Harvey's, Dog Zen) have no business_id — they continue working via client_id fallback
- Tasks always stay with the business record as the permanent thread through lead→client lifecycle
