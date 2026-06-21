# Task 1 - Hermes Lead Pipeline Integration ✅

**Completed**: 2026-06-21

## What Was Done
Wired the Command Center lead pipeline into Telegram via the Hermes messaging bridge, enabling Christopher to log conversations, move pipeline stages, and convert leads to clients directly from Telegram — no dashboard required.

## Key Changes
- Added `move_to_stage` RPC (`wpa.move_to_stage(p_business_id, p_stage)`) — updates `lifecycle_stage` and auto-logs a `stage_change` activity row in one call
- Expanded `lifecycle_stage` enum with full pipeline vocabulary: `identified → new → prospect → qualified → proposal → client`
- Wrote WPA Pipeline skill file to Hermes on beefy (`/home/wpauser/.hermes/hermes-agent/skills/wpa-pipeline/SKILL.md`)
- Provisioned `SUPABASE_ANON_KEY` to Hermes `.env` on beefy
- End-to-end verified via Bob: business resolution, stage move, activity logging all confirmed working

## Notes
Hermes calls Supabase REST directly (no new service, no frontend changes). All three RPCs now have anon GRANT: `append_activity`, `move_to_stage`, `convert_to_client`. The original `move_to_stage` migration had a text→enum cast error caught during verification — fixed in the follow-up `expand_lifecycle_stages` migration before any real use.
