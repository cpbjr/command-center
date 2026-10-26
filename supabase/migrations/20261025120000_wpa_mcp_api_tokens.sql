-- Migration: Hashed bearer tokens for the CRM MCP server
-- Date: 2026-10-25
-- Project: cfwaefobqjouyglocuyh  schema: wpa
--
-- Additive only. No data rewrite. Nothing in public.
-- Not applied by this change. Do not db push from this host.
--
-- Rollback: DROP TABLE wpa.mcp_api_tokens;
--
-- The raw token is shown once by `python -m mcp_crm.cli mint` and is not stored.
-- Revoke a token by setting revoked_at. Row level security is on with no policies,
-- so the anon and authenticated roles cannot read hashes. The service role can.
-- user_id is TEXT. The live subject is a Discord user id. Do not cast it to uuid.

CREATE TABLE IF NOT EXISTS wpa.mcp_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'grok',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mcp_api_tokens_user
  ON wpa.mcp_api_tokens (user_id);

ALTER TABLE wpa.mcp_api_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE wpa.mcp_api_tokens IS
  'SHA-256 hashes of CRM MCP bearer tokens. Subject is text, not uuid. Revoke by setting revoked_at.';
