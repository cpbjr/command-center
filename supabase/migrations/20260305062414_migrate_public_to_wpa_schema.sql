-- Migration: Migrate all tables from public schema to wpa schema
-- Date: 2026-03-05
-- Rollback: See rollback strategy in .agent/Tasks/Implementation/2026-03-05-migrate-public-to-wpa-schema.md

-- ============================================================
-- STEP 1: Create wpa schema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS wpa;

-- ============================================================
-- STEP 2: Drop all cross-table foreign keys
-- Must be dropped before SET SCHEMA to avoid cross-schema FK violations.
-- IF EXISTS guards make this safe even if a name differs from expected.
-- ============================================================
ALTER TABLE public.audits              DROP CONSTRAINT IF EXISTS audits_business_id_fkey;
ALTER TABLE public.wpa_contacts        DROP CONSTRAINT IF EXISTS wpa_contacts_business_id_fkey;
ALTER TABLE public.wpa_contacts        DROP CONSTRAINT IF EXISTS wpa_contacts_client_id_fkey;
ALTER TABLE public.wpa_contact_notes   DROP CONSTRAINT IF EXISTS wpa_contact_notes_contact_id_fkey;
ALTER TABLE public.wpa_documents       DROP CONSTRAINT IF EXISTS wpa_documents_client_id_fkey;
ALTER TABLE public.wpa_documents       DROP CONSTRAINT IF EXISTS wpa_documents_business_id_fkey;
ALTER TABLE public.wpa_tasks           DROP CONSTRAINT IF EXISTS wpa_tasks_client_id_fkey;
ALTER TABLE public.wpa_tasks           DROP CONSTRAINT IF EXISTS wpa_tasks_project_id_fkey;
ALTER TABLE public.wpa_tasks           DROP CONSTRAINT IF EXISTS wpa_tasks_business_id_fkey;
ALTER TABLE public.wpa_projects        DROP CONSTRAINT IF EXISTS wpa_projects_client_id_fkey;
ALTER TABLE public.wpa_project_updates DROP CONSTRAINT IF EXISTS wpa_project_updates_project_id_fkey;
ALTER TABLE public.wpa_client_activity   DROP CONSTRAINT IF EXISTS wpa_client_activity_client_id_fkey;
ALTER TABLE public.wpa_client_baselines  DROP CONSTRAINT IF EXISTS wpa_client_baselines_client_id_fkey;
ALTER TABLE public.wpa_gbp_scores        DROP CONSTRAINT IF EXISTS wpa_gbp_scores_client_id_fkey;

-- ============================================================
-- STEP 3: Drop public view (references tables that are about to move)
-- ============================================================
DROP VIEW IF EXISTS public.businesses_with_score;

-- ============================================================
-- STEP 4: Move all tables to wpa schema
-- SET SCHEMA preserves: data, sequences, indexes, check constraints, triggers
-- Does NOT preserve: RLS policies, grants (recreated below)
-- Order: no-dependency tables first, then dependents
-- ============================================================

-- No external dependencies
ALTER TABLE public.businesses  SET SCHEMA wpa;
ALTER TABLE public.daily_costs SET SCHEMA wpa;
ALTER TABLE public.wpa_clients SET SCHEMA wpa;

-- Depend on businesses / wpa_clients
ALTER TABLE public.audits               SET SCHEMA wpa;
ALTER TABLE public.wpa_projects         SET SCHEMA wpa;
ALTER TABLE public.wpa_tasks            SET SCHEMA wpa;
ALTER TABLE public.wpa_contacts         SET SCHEMA wpa;
ALTER TABLE public.wpa_client_activity  SET SCHEMA wpa;
ALTER TABLE public.wpa_client_baselines SET SCHEMA wpa;
ALTER TABLE public.wpa_gbp_scores       SET SCHEMA wpa;
ALTER TABLE public.wpa_documents        SET SCHEMA wpa;

-- Depend on wpa_contacts / wpa_projects
ALTER TABLE public.wpa_contact_notes   SET SCHEMA wpa;
ALTER TABLE public.wpa_project_updates SET SCHEMA wpa;

-- ============================================================
-- STEP 5: Rename the three non-prefixed tables
-- Note: associated sequences are renamed automatically by Postgres
-- ============================================================
ALTER TABLE wpa.businesses  RENAME TO wpa_businesses;
ALTER TABLE wpa.audits      RENAME TO wpa_audits;
ALTER TABLE wpa.daily_costs RENAME TO wpa_daily_costs;

-- ============================================================
-- STEP 6: Recreate all foreign keys within wpa schema
-- ============================================================
ALTER TABLE wpa.wpa_audits
  ADD CONSTRAINT wpa_audits_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES wpa.wpa_businesses(id) ON DELETE CASCADE;

ALTER TABLE wpa.wpa_contacts
  ADD CONSTRAINT wpa_contacts_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES wpa.wpa_businesses(id) ON DELETE CASCADE;

ALTER TABLE wpa.wpa_contacts
  ADD CONSTRAINT wpa_contacts_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES wpa.wpa_clients(id) ON DELETE CASCADE;

ALTER TABLE wpa.wpa_contact_notes
  ADD CONSTRAINT wpa_contact_notes_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES wpa.wpa_contacts(id) ON DELETE CASCADE;

ALTER TABLE wpa.wpa_documents
  ADD CONSTRAINT wpa_documents_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES wpa.wpa_clients(id) ON DELETE CASCADE;

ALTER TABLE wpa.wpa_documents
  ADD CONSTRAINT wpa_documents_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES wpa.wpa_businesses(id) ON DELETE CASCADE;

ALTER TABLE wpa.wpa_tasks
  ADD CONSTRAINT wpa_tasks_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES wpa.wpa_clients(id) ON DELETE SET NULL;

ALTER TABLE wpa.wpa_tasks
  ADD CONSTRAINT wpa_tasks_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES wpa.wpa_projects(id) ON DELETE SET NULL;

ALTER TABLE wpa.wpa_tasks
  ADD CONSTRAINT wpa_tasks_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES wpa.wpa_businesses(id) ON DELETE SET NULL;

ALTER TABLE wpa.wpa_projects
  ADD CONSTRAINT wpa_projects_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES wpa.wpa_clients(id) ON DELETE SET NULL;

ALTER TABLE wpa.wpa_project_updates
  ADD CONSTRAINT wpa_project_updates_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES wpa.wpa_projects(id) ON DELETE CASCADE;

ALTER TABLE wpa.wpa_client_activity
  ADD CONSTRAINT wpa_client_activity_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES wpa.wpa_clients(id) ON DELETE CASCADE;

ALTER TABLE wpa.wpa_client_baselines
  ADD CONSTRAINT wpa_client_baselines_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES wpa.wpa_clients(id) ON DELETE CASCADE;

ALTER TABLE wpa.wpa_gbp_scores
  ADD CONSTRAINT wpa_gbp_scores_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES wpa.wpa_clients(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 7: Re-enable RLS on all tables
-- (RLS policies are dropped when tables move schemas)
-- Use DROP POLICY IF EXISTS first to handle any stale policies
-- from prior partial migration attempts.
-- ============================================================
ALTER TABLE wpa.wpa_businesses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpa.wpa_audits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpa.wpa_daily_costs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpa.wpa_clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpa.wpa_tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpa.wpa_projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpa.wpa_project_updates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpa.wpa_contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpa.wpa_contact_notes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpa.wpa_client_activity  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpa.wpa_client_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpa.wpa_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpa.wpa_gbp_scores       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_full_access" ON wpa.wpa_businesses;
DROP POLICY IF EXISTS "anon_full_access" ON wpa.wpa_audits;
DROP POLICY IF EXISTS "anon_full_access" ON wpa.wpa_daily_costs;
DROP POLICY IF EXISTS "anon_full_access" ON wpa.wpa_clients;
DROP POLICY IF EXISTS "anon_full_access" ON wpa.wpa_tasks;
DROP POLICY IF EXISTS "anon_full_access" ON wpa.wpa_projects;
DROP POLICY IF EXISTS "anon_full_access" ON wpa.wpa_project_updates;
DROP POLICY IF EXISTS "anon_full_access" ON wpa.wpa_contacts;
DROP POLICY IF EXISTS "anon_full_access" ON wpa.wpa_contact_notes;
DROP POLICY IF EXISTS "anon_full_access" ON wpa.wpa_client_activity;
DROP POLICY IF EXISTS "anon_full_access" ON wpa.wpa_client_baselines;
DROP POLICY IF EXISTS "anon_full_access" ON wpa.wpa_documents;
DROP POLICY IF EXISTS "anon_full_access" ON wpa.wpa_gbp_scores;

CREATE POLICY "anon_full_access" ON wpa.wpa_businesses       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON wpa.wpa_audits           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON wpa.wpa_daily_costs      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON wpa.wpa_clients          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON wpa.wpa_tasks            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON wpa.wpa_projects         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON wpa.wpa_project_updates  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON wpa.wpa_contacts         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON wpa.wpa_contact_notes    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON wpa.wpa_client_activity  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON wpa.wpa_client_baselines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON wpa.wpa_documents        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON wpa.wpa_gbp_scores       FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- STEP 8: Schema-level and table-level grants
-- ============================================================
GRANT USAGE ON SCHEMA wpa TO anon, authenticated;

GRANT ALL ON wpa.wpa_businesses       TO anon, authenticated;
GRANT ALL ON wpa.wpa_audits           TO anon, authenticated;
GRANT ALL ON wpa.wpa_daily_costs      TO anon, authenticated;
GRANT ALL ON wpa.wpa_clients          TO anon, authenticated;
GRANT ALL ON wpa.wpa_tasks            TO anon, authenticated;
GRANT ALL ON wpa.wpa_projects         TO anon, authenticated;
GRANT ALL ON wpa.wpa_project_updates  TO anon, authenticated;
GRANT ALL ON wpa.wpa_contacts         TO anon, authenticated;
GRANT ALL ON wpa.wpa_contact_notes    TO anon, authenticated;
GRANT ALL ON wpa.wpa_client_activity  TO anon, authenticated;
GRANT ALL ON wpa.wpa_client_baselines TO anon, authenticated;
GRANT ALL ON wpa.wpa_documents        TO anon, authenticated;
GRANT ALL ON wpa.wpa_gbp_scores       TO anon, authenticated;

-- Sequence grants (sequences move with tables but grants must be reapplied)
-- Use ALL SEQUENCES IN SCHEMA to avoid hardcoding sequence names that may
-- differ based on original table names before rename.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA wpa TO anon, authenticated;

-- ============================================================
-- STEP 9: Recreate view in wpa schema as wpa_businesses_with_score
-- ============================================================
CREATE VIEW wpa.wpa_businesses_with_score AS
SELECT b.*, a.score AS latest_score
FROM wpa.wpa_businesses b
LEFT JOIN LATERAL (
  SELECT score FROM wpa.wpa_audits
  WHERE business_id = b.id
  ORDER BY audited_at DESC
  LIMIT 1
) a ON true;

GRANT SELECT ON wpa.wpa_businesses_with_score TO anon, authenticated;
