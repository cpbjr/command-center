# Fix: public.* Proxy Views SECURITY DEFINER → SECURITY INVOKER

**Date:** 2026-06-07
**Completed:** 2026-06-07
**Status:** ✅ Complete

---

## Context

Supabase Security Advisor sent an email warning that `public.contacts_summary` (and other `public.*` views) were defined with the `SECURITY DEFINER` property. This causes views to execute as their owner (postgres) rather than the calling user, bypassing RLS on underlying tables.

---

## Investigation

The flagged views are **not** from CommandCenter. They originate from the abandoned `atomic-crm` project (`~/WhitePineAgency/Sites/atomic-crm/`) which shares the same Supabase instance (`klyzdnocgrvassppripi`). The CRM app uses a `crm` schema, and these `public.*` views are proxy wrappers over it.

**Why they had SECURITY DEFINER:**
Migration `20260226080000_fix_proxy_views_security_definer.sql` in atomic-crm deliberately set `security_invoker=OFF` on all proxy views to fix write-through issues — PostgREST was calling views as `anon`/`authenticated`, and the `crm.*` tables' RLS rejected those writes. Running as the view owner (postgres) bypassed that.

**Why it's safe to revert now:**
atomic-crm is abandoned in favor of CommandCenter. No active writes are going through these views anymore.

**CommandCenter impact:** None. CommandCenter uses the `wpa` schema exclusively. These views are entirely separate.

---

## Affected Views (all in `public` schema)

- `contacts_summary` → `crm.contacts_summary`
- `contacts` → `crm.contacts`
- `companies` → `crm.companies`
- `companies_summary` → `crm.companies_summary`
- `deals` → `crm.deals`
- `contact_notes` → `crm.contact_notes`
- `deal_notes` → `crm.deal_notes`
- `tasks` → `crm.tasks`
- `tags` → `crm.tags`
- `configuration` → `crm.configuration`
- `favicons_excluded_domains` → `crm.favicons_excluded_domains`

---

## What Was Done

Applied SQL directly via `supabase db query --linked` from the atomic-crm project directory (bypassing migration tracking conflicts caused by the shared Supabase instance):

```bash
cd ~/WhitePineAgency/Sites/atomic-crm
npx supabase@latest db query --linked --file supabase/migrations/20260607_01_fix_public_proxy_views_security_invoker.sql
```

Each view was recreated with `security_invoker=ON` (SECURITY INVOKER mode).

Migration file saved at:
`~/WhitePineAgency/Sites/atomic-crm/supabase/migrations/20260607_01_fix_public_proxy_views_security_invoker.sql`

---

## Verification

Confirmed via:
```sql
SELECT viewname, reloptions FROM pg_views
JOIN pg_class ON relname = viewname
WHERE schemaname = 'public' AND viewname IN ('contacts_summary','contacts','companies',...)
```

All affected views returned `reloptions: ["security_invoker=on"]`. ✅

Supabase Security Advisor should clear the flag on its next scan.
