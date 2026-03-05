-- Migration: Create businesses_with_score view
-- Date: 2026-02-24
-- Rollback: DROP VIEW IF EXISTS public.businesses_with_score;

CREATE OR REPLACE VIEW public.businesses_with_score AS
SELECT
  b.*,
  a.score AS latest_score
FROM public.businesses b
LEFT JOIN LATERAL (
  SELECT score
  FROM public.audits
  WHERE business_id = b.id
  ORDER BY audited_at DESC
  LIMIT 1
) a ON true;

GRANT SELECT ON public.businesses_with_score TO anon, authenticated;
