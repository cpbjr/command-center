# Task 1 - Rename "Churned" Client Status to "Completed" ✅

**Completed**: 2026-07-08

## What Was Done
The "Churned" client status label read poorly for clients whose engagement simply finished successfully rather than ending badly. Relabeled it to "Completed" throughout the Clients UI — no schema or data changes, since the underlying `churned` value in `wpa_contracts.status` still works fine as the internal identifier.

## Key Changes
- [ClientCard.tsx](../../../../src/components/clients/ClientCard.tsx) status dot now shows "Completed" instead of "Churned"
- [ClientForm.tsx](../../../../src/components/clients/ClientForm.tsx) status dropdown now shows "Completed" via an explicit label map (previously auto-capitalized the raw enum value)

## Notes
Considered adding a distinct `completed` status value alongside `churned` (to separate "finished successfully" from "actually churned/fired"), but decided a pure label rename was sufficient for now — least invasive, no migration needed.
