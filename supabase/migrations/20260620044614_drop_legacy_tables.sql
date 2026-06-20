-- Migration: drop legacy tables (data already migrated to wpa_contracts and wpa_activity)
-- Rollback: (non-trivial — re-create from backups; do NOT run on production without backup)

DROP TABLE IF EXISTS wpa.wpa_client_activity;
DROP TABLE IF EXISTS wpa.wpa_business_activity;
DROP TABLE IF EXISTS wpa.wpa_clients;
