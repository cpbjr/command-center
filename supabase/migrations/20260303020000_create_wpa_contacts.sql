-- Migration: Create wpa_contacts + wpa_contact_notes tables
-- Date: 2026-03-03
-- Rollback: DROP TABLE public.wpa_contact_notes; DROP TABLE public.wpa_contacts;

CREATE TABLE public.wpa_contacts (
  id BIGSERIAL PRIMARY KEY,
  -- Link to either a lead (businesses) or active client (wpa_clients) — one or the other
  business_id TEXT REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id BIGINT REFERENCES public.wpa_clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',           -- e.g. "Owner", "Manager", "Front Desk"
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT DEFAULT '',          -- quick one-liner notes
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wpa_contacts_business_id ON public.wpa_contacts(business_id);
CREATE INDEX idx_wpa_contacts_client_id ON public.wpa_contacts(client_id);

-- Outreach log per contact
CREATE TABLE public.wpa_contact_notes (
  id BIGSERIAL PRIMARY KEY,
  contact_id BIGINT NOT NULL REFERENCES public.wpa_contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note'
    CHECK (type IN ('call', 'email', 'meeting', 'text', 'note')),
  body TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wpa_contact_notes_contact_id ON public.wpa_contact_notes(contact_id);

-- RLS: anon full access (single-user internal tool)
ALTER TABLE public.wpa_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wpa_contact_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_full_access" ON public.wpa_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON public.wpa_contact_notes FOR ALL USING (true) WITH CHECK (true);
