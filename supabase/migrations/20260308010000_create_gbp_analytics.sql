-- Migration: create gbp_analytics
-- Date: 2026-03-08
-- Rollback: DROP TABLE wpa.gbp_analytics;

CREATE TABLE wpa.gbp_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id BIGINT NOT NULL REFERENCES wpa.wpa_clients(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('week', 'month')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_searches INTEGER,
  direct_searches INTEGER,
  discovery_searches INTEGER,
  calls INTEGER,
  website_clicks INTEGER,
  direction_requests INTEGER,
  photo_views INTEGER,
  review_count INTEGER,
  avg_rating NUMERIC(3,1),
  new_reviews INTEGER,
  citation_count INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX gbp_analytics_client_period ON wpa.gbp_analytics(client_id, period_start DESC);
