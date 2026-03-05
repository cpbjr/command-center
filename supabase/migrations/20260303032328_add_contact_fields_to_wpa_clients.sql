-- Migration: Add contact fields to wpa_clients
-- Date: 2026-03-03
-- Rollback: ALTER TABLE public.wpa_clients DROP COLUMN address, DROP COLUMN phone, DROP COLUMN website_url;

ALTER TABLE public.wpa_clients
  ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS website_url TEXT DEFAULT '';
