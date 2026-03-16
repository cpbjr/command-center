# Plan: Analytics Reporter — GBP Tab Enhancement in Command Center

**Status: COMPLETED 2026-03-12**
**Commits:** `2e40840` (analytics feature), `5722639` (targeted status, separate session)

## What Was Built

- `wpa.gbp_analytics` Supabase table — schema corrected to match actual `wpa` schema and `BIGINT` client IDs
- `src/components/clients/AnalyticsWidget.tsx` — period selector, 4 scorecard tiles with ↑/↓ deltas, inline Add Data form, Generate Report modal with Weekly Snapshot + Monthly Report templates
- `src/hooks/use-gbp-analytics.ts` — React Query hooks for fetch + mutation
- Wired into GBP tab in `src/components/clients/ClientForm.tsx`
- Build passes, zero console errors verified

## Context
WPA needs to track GBP metrics (searches, actions, reviews, citations) per client and generate client reports. Rather than a separate Analytics page, this fits naturally into the existing GBP tab inside the client edit sheet in the Command Center. Data entry is manual for now; OC Bob will write to the same table when the pipeline is ready. Report delivery is markdown copy-paste initially, with PDF as a follow-on.

## Data Flow
```
Manual entry (Add Data form) → wpa.gbp_analytics table
OC Bob pipeline (future)    → wpa.gbp_analytics table (same schema)
                                      ↓
                          AnalyticsWidget reads + displays
                                      ↓
                          Generate Report → markdown modal → clipboard
                                      ↓
                          (Future) PDF via document-skills:pdf
```

## Future Work
- OC Bob pipeline to write GBP data to `wpa.gbp_analytics` automatically
- PDF export via `document-skills:pdf` skill
- Trend charts once multiple periods of data exist
