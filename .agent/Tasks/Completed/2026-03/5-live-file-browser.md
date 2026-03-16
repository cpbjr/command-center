# Task 5 - Live File Browser (Docs Tab) ✅

**Completed**: 2026-03-15

## What Was Done
Added a live file tree browser to both the client and lead detail panels, allowing direct browsing of operational files (context docs, one-pagers, comms) stored on the WPA file server — accessible from the dashboard on desktop and mobile without leaving the app.

## Key Changes
- New `src/hooks/use-file-tree.ts` — React Query hook that fetches directory listings and file URLs from the file server API using `X-Api-Key` auth
- New `src/components/clients/DocumentList.tsx` — replaces old DB-backed document list with a live file tree: folder navigation, breadcrumbs, file icons, opens files in new tab
- `src/components/leads/LeadDetail.tsx` — added Details/Docs tabs; Docs tab shows `DocumentList` for the lead's folder
- `src/components/clients/ClientForm.tsx` — Docs tab wired to live file tree; added "File server folder" input field for setting `folder_path`
- `folder_path` column added to `wpa.wpa_businesses` (migration `20260315212654`) and `wpa.wpa_clients` (migration `20260315230417`); `wpa_businesses_with_score` view recreated to include column
- File server seeded: 11 lead records + 2 clients linked to their file server folders
- CORS headers added to the WPA file server (`server.js` on beefy) — allows requests from dashboard domain and `localhost:5173`
- `VITE_FILE_SERVER_BASE_URL` and `VITE_FILE_SERVER_API_KEY` added to `.env` and GitHub Actions secrets

## Notes
- `wpa_clients` is in the `wpa` schema (not `public`) — two separate tables exist; app always uses `Accept-Profile: wpa` via `db: { schema: 'wpa' }` in the Supabase client
- `wpa_businesses_with_score` uses `SELECT b.*` so it must be DROP+recreated whenever new columns are added to `wpa_businesses`
- Implementation plan: `.agent/Tasks/Implementation/2026-03-14-doc-tabs.md` (archived)
