-- Migration: migrate client_id FK on tasks/projects/documents to contract_id
-- and drop wpa_clients FK constraints on GBP tables
-- Date: 2026-06-20
-- Rollback: Reverse: add client_id back with FK to wpa_clients, restore GBP FK constraints

-- === wpa_tasks ===
ALTER TABLE wpa.wpa_tasks ADD COLUMN contract_id INT REFERENCES wpa.wpa_contracts(id);

UPDATE wpa.wpa_tasks t
SET contract_id = c.id
FROM wpa.wpa_contracts c
JOIN wpa.wpa_clients cl ON c.business_id = cl.business_id
WHERE t.client_id = cl.id;

ALTER TABLE wpa.wpa_tasks DROP COLUMN client_id;

-- === wpa_projects ===
ALTER TABLE wpa.wpa_projects ADD COLUMN contract_id INT REFERENCES wpa.wpa_contracts(id);

UPDATE wpa.wpa_projects p
SET contract_id = c.id
FROM wpa.wpa_contracts c
JOIN wpa.wpa_clients cl ON c.business_id = cl.business_id
WHERE p.client_id = cl.id;

ALTER TABLE wpa.wpa_projects DROP COLUMN client_id;

-- === wpa_documents ===
ALTER TABLE wpa.wpa_documents ADD COLUMN contract_id INT REFERENCES wpa.wpa_contracts(id);

UPDATE wpa.wpa_documents d
SET contract_id = c.id
FROM wpa.wpa_contracts c
JOIN wpa.wpa_clients cl ON c.business_id = cl.business_id
WHERE d.client_id = cl.id;

ALTER TABLE wpa.wpa_documents DROP COLUMN client_id;

-- === GBP/baseline tables: drop FK constraints pointing to wpa_clients ===
-- (keep client_id as plain int; contract IDs 1,2,3 match old client IDs 1,2,3)
ALTER TABLE wpa.wpa_client_baselines DROP CONSTRAINT IF EXISTS wpa_client_baselines_client_id_fkey;
ALTER TABLE wpa.wpa_gbp_scores DROP CONSTRAINT IF EXISTS wpa_gbp_scores_client_id_fkey;
ALTER TABLE wpa.gbp_analytics DROP CONSTRAINT IF EXISTS gbp_analytics_client_id_fkey;
ALTER TABLE wpa.wpa_gbp_insights DROP CONSTRAINT IF EXISTS wpa_gbp_insights_client_id_fkey;
ALTER TABLE wpa.wpa_weekly_reports DROP CONSTRAINT IF EXISTS wpa_weekly_reports_client_id_fkey;
ALTER TABLE wpa.wpa_client_activity DROP CONSTRAINT IF EXISTS wpa_client_activity_client_id_fkey;
