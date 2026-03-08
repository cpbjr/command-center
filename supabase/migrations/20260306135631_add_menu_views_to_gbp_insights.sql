-- Migration: Add menu_views column to wpa_gbp_insights
-- Date: 2026-03-06
-- Rollback: ALTER TABLE wpa.wpa_gbp_insights DROP COLUMN menu_views;

ALTER TABLE wpa.wpa_gbp_insights ADD COLUMN menu_views INTEGER;
