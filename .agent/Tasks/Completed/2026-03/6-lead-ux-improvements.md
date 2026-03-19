# Task 6 - Lead UX Improvements ✅

**Completed**: 2026-03-19

## What Was Done
Resolved four lead management pain points: truncated lead dropdown in task forms, missing delete functionality for leads, contact edit capability, and pre-population of lead when creating tasks from a lead's detail panel.

## Key Changes
- Lead selector in TaskForm replaced with searchable combobox — type to filter 1,900+ businesses instantly
- Fixed root cause of missing leads: Supabase's default 1,000-row limit was truncating the list; added `.limit(10000)`
- Lead name now passed as prop so it displays immediately on TaskForm open (before query resolves)
- Added `useDeleteBusiness()` hook + trash icon button with confirmation dialog in LeadDetail
- Added pencil icon edit button to each ContactRow — expands inline edit form pre-filled with current values
- Updated Aarin (Heritage Plumbing LLC) contact with email: heritageplumbingllc@gmail.com
- Committed two previously untracked schema migrations (gbp_primary_type + wpa_service_ranks)

## Notes
Contacts already displayed phone/email correctly — no changes needed there. The "Create Task" auto-population from LeadDetail was also already wired correctly via `defaultBusinessId`; the issue was purely the row limit preventing the lead from appearing in the dropdown.
