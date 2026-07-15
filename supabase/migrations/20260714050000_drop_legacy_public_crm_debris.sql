-- Migration: Drop legacy public + crm debris (in-place on shared project klyzdnocgrvassppripi)
-- Date: 2026-07-14
-- Context: Command Center uses schema `wpa` exclusively. This removes the empty Atomic CRM
--   install, its public passthrough views, and stale pre-migration CC table duplicates.
--   Precursor to migrating only `wpa` to the dedicated WPA project (cfwaefobqjouyglocuyh).
-- Recovery: .agent/Tasks/Implementation/artifacts/2026-07-14-public-crm-legacy-snapshot.sql
-- Rollback: forward-only — recreate from the snapshot SQL. CRM was empty (0 rows); only the
--   wpa.winnow_performance view (recreated below) and the empty CRM scaffold would need re-applying.
--
-- NOT TOUCHED (other WhitePineTech projects sharing this DB):
--   public.jobs, public.staff, public.daily_costs; schemas maintenance_log, taskboard;
--   public functions update_updated_at_column, update_user_activity, is_admin (shared/RLS).

-- ── Step 1: recreate winnow_performance in wpa (pure aggregation over wpa.wpa_winnow_decisions) ──
CREATE OR REPLACE VIEW "wpa"."winnow_performance" AS
 SELECT
        CASE
            WHEN (winnow_score >= 55) THEN 'auto-identified (>=55)'::text
            WHEN (winnow_score >= 25) THEN 'middle-band (25-54)'::text
            ELSE 'skip/closed (<25)'::text
        END AS score_band,
    decision,
    haiku_decision,
    count(*) AS total_decisions,
    count(outcome_actual) AS with_outcome,
    count(CASE WHEN (outcome_actual = ANY (ARRAY['CONTACTED'::text, 'REPLIED'::text, 'CLOSED-WON'::text])) THEN 1 ELSE NULL::integer END) AS converted,
    count(CASE WHEN override_by_human THEN 1 ELSE NULL::integer END) AS human_overrides,
    round(((100.0 * (count(CASE WHEN (outcome_actual = ANY (ARRAY['CONTACTED'::text, 'REPLIED'::text, 'CLOSED-WON'::text])) THEN 1 ELSE NULL::integer END))::numeric) / (NULLIF(count(outcome_actual), 0))::numeric), 1) AS conversion_rate_pct
   FROM "wpa"."wpa_winnow_decisions"
  GROUP BY
        CASE
            WHEN (winnow_score >= 55) THEN 'auto-identified (>=55)'::text
            WHEN (winnow_score >= 25) THEN 'middle-band (25-54)'::text
            ELSE 'skip/closed (<25)'::text
        END, decision, haiku_decision
  ORDER BY
        CASE
            WHEN (winnow_score >= 55) THEN 'auto-identified (>=55)'::text
            WHEN (winnow_score >= 25) THEN 'middle-band (25-54)'::text
            ELSE 'skip/closed (<25)'::text
        END, decision;

GRANT SELECT ON TABLE "wpa"."winnow_performance" TO "anon";
GRANT SELECT ON TABLE "wpa"."winnow_performance" TO "authenticated";
GRANT SELECT ON TABLE "wpa"."winnow_performance" TO "service_role";

-- ── Step 3: drop the auth.users triggers that call crm functions (before dropping crm) ──
DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";
DROP TRIGGER IF EXISTS "on_auth_user_updated" ON "auth"."users";

-- ── Step 4: drop the entire empty Atomic CRM install (tables, seqs, funcs, crm triggers,
--            and the public passthrough views that depend on crm.* — all via CASCADE) ──
DROP SCHEMA IF EXISTS "crm" CASCADE;

-- ── Step 5: drop CRM-orphan public helper functions (their only dependents were crm triggers) ──
DROP FUNCTION IF EXISTS "public"."handle_company_saved"() CASCADE;
DROP FUNCTION IF EXISTS "public"."handle_contact_saved"() CASCADE;
DROP FUNCTION IF EXISTS "public"."handle_contact_note_created_or_updated"() CASCADE;

-- ── Step 6: drop the superseded public winnow_performance view (replaced by wpa version above) ──
DROP VIEW IF EXISTS "public"."winnow_performance";

-- ── Step 7: drop the stale pre-migration CC table duplicates in public (live data is in wpa.*) ──
DROP TABLE IF EXISTS "public"."audits" CASCADE;
DROP TABLE IF EXISTS "public"."businesses" CASCADE;
DROP TABLE IF EXISTS "public"."wpa_contact_notes" CASCADE;
DROP TABLE IF EXISTS "public"."wpa_contacts" CASCADE;
DROP TABLE IF EXISTS "public"."wpa_tasks" CASCADE;
DROP TABLE IF EXISTS "public"."wpa_projects" CASCADE;
DROP TABLE IF EXISTS "public"."wpa_clients" CASCADE;
