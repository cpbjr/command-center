-- Migration: Create CRM tables (businesses + audits)
-- Date: 2026-02-23
-- Rollback: DROP TABLE public.audits; DROP TABLE public.businesses;

-- businesses table
CREATE TABLE public.businesses (
  id TEXT PRIMARY KEY,                    -- Google Place ID
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  website_url TEXT DEFAULT '',
  gbp_categories JSONB DEFAULT '[]',     -- was TEXT JSON string
  search_query TEXT NOT NULL DEFAULT '',
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  contact_status TEXT NOT NULL DEFAULT 'NEW'
    CHECK (contact_status IN ('NEW', 'CONTACTED', 'REPLIED', 'CLOSED')),
  discovery_rank INTEGER,
  rank_total_candidates INTEGER,
  google_maps_uri TEXT DEFAULT '',
  business_status TEXT DEFAULT '',
  rating NUMERIC(3,2),
  user_rating_count INTEGER,
  raw_data JSONB,                         -- was TEXT JSON string
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- audits table
CREATE TABLE public.audits (
  id BIGSERIAL PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  has_schema BOOLEAN DEFAULT false,
  has_sameas BOOLEAN DEFAULT false,
  category_aligned BOOLEAN DEFAULT false,
  nap_consistent BOOLEAN DEFAULT false,
  mobile_speed_score INTEGER CHECK (mobile_speed_score >= 0 AND mobile_speed_score <= 100),
  mobile_lcp NUMERIC(10,2),
  raw_schema JSONB,
  issues JSONB DEFAULT '[]',
  score INTEGER CHECK (score >= 0 AND score <= 5),
  audited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hosting_provider TEXT,
  hosting_cost_min INTEGER,
  hosting_cost_max INTEGER,
  hosting_savings_min INTEGER,
  hosting_savings_max INTEGER,
  pitch_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_businesses_contact_status ON public.businesses(contact_status);
CREATE INDEX idx_businesses_search_query ON public.businesses(search_query);
CREATE INDEX idx_businesses_discovered_at ON public.businesses(discovered_at DESC);
CREATE INDEX idx_audits_business_id ON public.audits(business_id);
CREATE INDEX idx_audits_score ON public.audits(score);

-- RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.businesses
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_full_access" ON public.audits
  FOR ALL USING (auth.role() = 'authenticated');
