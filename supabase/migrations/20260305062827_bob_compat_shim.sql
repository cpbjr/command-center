-- Migration: OC Bob compatibility shim
-- Date: 2026-03-05
-- Purpose: OC Bob queries GET /rest/v1/wpa_tasks without an Accept-Profile header,
--          which routes to the public schema. wpa_tasks no longer exists in public
--          after the schema migration. This view proxies public.wpa_tasks -> wpa.wpa_tasks
--          so Bob continues working without changes.
--
-- Remove when OC Bob is updated to send Accept-Profile: wpa header.

CREATE OR REPLACE VIEW public.wpa_tasks AS
  SELECT * FROM wpa.wpa_tasks;

GRANT SELECT, UPDATE ON public.wpa_tasks TO anon, authenticated;
