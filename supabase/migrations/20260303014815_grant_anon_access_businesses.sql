-- Migration: Grant anon access to businesses and audits tables
-- Date: 2026-03-03
-- Rollback: DROP POLICY "anon_full_access" ON public.businesses;
--           DROP POLICY "anon_full_access" ON public.audits;
--           REVOKE ALL ON public.businesses FROM anon;
--           REVOKE ALL ON public.audits FROM anon;

-- Add permissive anon policy for businesses (currently only authenticated)
CREATE POLICY "anon_full_access" ON public.businesses
  FOR ALL USING (true) WITH CHECK (true);

-- Add permissive anon policy for audits
CREATE POLICY "anon_full_access" ON public.audits
  FOR ALL USING (true) WITH CHECK (true);

-- Grant table permissions to anon role
GRANT ALL ON public.businesses TO anon;
GRANT ALL ON public.audits TO anon;
