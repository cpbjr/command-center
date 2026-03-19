-- Migration: Create wpa_service_ranks table for multi-service discovery
-- Tracks per-business discovery rank across multiple service queries

CREATE TABLE IF NOT EXISTS wpa.wpa_service_ranks (
    id              BIGSERIAL PRIMARY KEY,
    business_id     TEXT NOT NULL REFERENCES wpa.wpa_businesses(id) ON DELETE CASCADE,
    service_query   TEXT NOT NULL,
    service_label   TEXT NOT NULL,
    discovery_rank  INTEGER,
    total_results   INTEGER,
    discovered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(business_id, service_query)
);

CREATE INDEX IF NOT EXISTS idx_service_ranks_business_id ON wpa.wpa_service_ranks(business_id);
