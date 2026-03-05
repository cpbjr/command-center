-- Migration: Add last_name column to wpa_contacts
-- Date: 2026-03-03
-- Rollback: ALTER TABLE public.wpa_contacts DROP COLUMN last_name;

ALTER TABLE public.wpa_contacts ADD COLUMN last_name TEXT NOT NULL DEFAULT '';
