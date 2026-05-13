-- ================================================================
-- Migration: Add description, category, intake_schema to templates
-- ================================================================
-- Run this in Supabase Dashboard → SQL Editor
-- Adds fields needed for domain-specific seed templates.
-- Also allows user_id to be NULL for system/seed templates.
-- ================================================================

-- New columns
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS description   TEXT,
  ADD COLUMN IF NOT EXISTS category      TEXT,
  ADD COLUMN IF NOT EXISTS intake_schema JSONB DEFAULT '[]';

-- Allow system templates (no owner)
ALTER TABLE templates
  ALTER COLUMN user_id DROP NOT NULL;

-- System templates (user_id IS NULL, is_public = TRUE) are readable by all
-- via the existing "templates: public readable" policy.
-- They cannot be edited by anyone through RLS, which is correct.
