-- Migration: Add 'plan' type to wpa_documents
-- Date: 2026-03-03
-- Rollback: ALTER TABLE public.wpa_documents DROP CONSTRAINT IF EXISTS wpa_documents_type_check; ALTER TABLE public.wpa_documents ADD CONSTRAINT wpa_documents_type_check CHECK (type IN ('receipt', 'pdf', 'image', 'link', 'note'));

ALTER TABLE public.wpa_documents
  DROP CONSTRAINT IF EXISTS wpa_documents_type_check;

ALTER TABLE public.wpa_documents
  ADD CONSTRAINT wpa_documents_type_check
  CHECK (type IN ('receipt', 'pdf', 'image', 'link', 'note', 'plan'));
