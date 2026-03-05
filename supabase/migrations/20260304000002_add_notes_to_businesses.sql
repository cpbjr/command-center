-- Migration: Add notes column to businesses
-- Date: 2026-03-04
-- Rollback: ALTER TABLE public.businesses DROP COLUMN IF EXISTS notes;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
