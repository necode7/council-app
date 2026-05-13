-- ================================================================
-- Migration: Add domain and bio to profiles
-- ================================================================
-- Run this ONLY if you already ran schema.sql without these columns.
-- If you're running schema.sql fresh, skip this file.
-- ================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS bio    TEXT;
