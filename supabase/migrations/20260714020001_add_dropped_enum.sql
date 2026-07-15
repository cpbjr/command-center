-- Migration: add 'dropped' to lifecycle_stage enum (Phase 2 Step 5, additive)
-- Date: 2026-07-14
-- Kept in its own migration file: ALTER TYPE ... ADD VALUE cannot run inside a
--   transaction block alongside other statements. The new_prospect/relationship_ended
--   remap + old-value removal happens in the gated Task 5.9.
-- Rollback: ALTER TYPE cannot remove an enum value; a 'dropped' value added here is
--   permanent (acceptable — it's part of the target model).

ALTER TYPE wpa.lifecycle_stage ADD VALUE IF NOT EXISTS 'dropped';
