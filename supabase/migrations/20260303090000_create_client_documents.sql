-- Migration: Create wpa_documents for client/business file and document links
-- Date: 2026-03-03
-- Rollback: DROP TABLE IF EXISTS public.wpa_documents;

CREATE TABLE public.wpa_documents (
  id          BIGSERIAL PRIMARY KEY,
  client_id   BIGINT REFERENCES public.wpa_clients(id) ON DELETE CASCADE,
  business_id TEXT REFERENCES public.businesses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  type        TEXT CHECK (type IN ('receipt', 'pdf', 'image', 'link', 'note')),
  file_path   TEXT,
  url         TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX wpa_documents_client_id_idx ON public.wpa_documents(client_id);
CREATE INDEX wpa_documents_business_id_idx ON public.wpa_documents(business_id);

ALTER TABLE public.wpa_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access" ON public.wpa_documents FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.wpa_documents TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.wpa_documents_id_seq TO anon, authenticated;

-- Seed Harvey's engagement letter
INSERT INTO public.wpa_documents (client_id, title, type, file_path) VALUES (
  (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1),
  'Engagement Letter (2026-02-20)',
  'note',
  'Clients/Active/Harveys-on-the-Green/Communication/engagement-letter-2026-02-20.md'
);
