# Deployment

## Overview

The Command Center dashboard is a static React app. GitHub Actions builds it and rsyncs `dist/` on a push to `main`, unless every changed file is in `paths-ignore`. The CRM MCP is a separate container. That rsync does not start it.

## Target

- **Server:** whitepine (`5.78.128.255`). Beefy is retired. Do not deploy there.
- **Dashboard files:** `/home/deploy/websites/dashboard/`
- **Live URL:** [dashboard.whitepineagency.com](https://dashboard.whitepineagency.com)
- **CRM MCP:** `https://whitepine-tech.com/crm/mcp` on container `command-center-mcp`

## CI Workflow

`.github/workflows/deploy.yml` (in this repo):

1. On push to `main`, unless every changed file is in `paths-ignore`
2. `npm ci && npm run build` — produces `dist/`
3. rsync `dist/` to whitepine `/home/deploy/websites/dashboard/`

SSH key is stored as a GitHub Actions secret (`BEEFY_SSH_KEY`).

## Manual Deploy

If CI is unavailable:
```bash
npm run build
rsync -avz --delete dist/ wpauser@5.78.128.255:/home/deploy/websites/dashboard/
```

## Environment Variables

Required in `.env` (not committed):
```
VITE_SUPABASE_URL=https://cfwaefobqjouyglocuyh.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

For CI, these are set as GitHub Actions secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

## Nginx

The VPS serves the app from `/var/www/dashboard/` with a standard nginx config. SPA routing requires a catch-all:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```
