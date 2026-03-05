# Deployment

## Overview

The Command Center is a static React app deployed to a Hetzner VPS via GitHub Actions CI on every push to `main`.

## Target

- **Server:** beefy (Hetzner VPS, 5.78.152.85)
- **User:** `wpauser`
- **Web root:** `/var/www/dashboard/`
- **Live URL:** [dashboard.whitepineagency.com](https://dashboard.whitepineagency.com)

## CI Workflow

`.github/workflows/deploy.yml` (in this repo):

1. On push to `main`
2. `npm ci && npm run build` — produces `dist/`
3. `rsync -avz --delete dist/ wpauser@5.78.152.85:/var/www/dashboard/`

SSH key is stored as a GitHub Actions secret (`BEEFY_SSH_KEY`).

## Manual Deploy

If CI is unavailable:
```bash
npm run build
rsync -avz --delete dist/ wpauser@5.78.152.85:/var/www/dashboard/
```

## Environment Variables

Required in `.env` (not committed):
```
VITE_SUPABASE_URL=https://klyzdnocgrvassppripi.supabase.co
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
