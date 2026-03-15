-- Migration: Add folder_path to wpa.wpa_clients
-- Date: 2026-03-15
-- Reason: wpa_clients lives in wpa schema; add folder_path for file server integration

ALTER TABLE wpa.wpa_clients ADD COLUMN IF NOT EXISTS folder_path TEXT;

COMMENT ON COLUMN wpa.wpa_clients.folder_path IS 'File server path relative to /files/ root, e.g. WhitePineAgency/Clients/Active/Harveys-at-BanBury';

-- Seed known client folders
UPDATE wpa.wpa_clients SET folder_path = 'WhitePineAgency/Clients/Active/Harveys-at-BanBury'
  WHERE id = 2;

UPDATE wpa.wpa_clients SET folder_path = 'WhitePineAgency/Clients/Active/Dog-Zen'
  WHERE id = 3;
