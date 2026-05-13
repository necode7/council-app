-- ================================================================
-- Migration: Credits System
-- ================================================================
-- Run this in Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. Add credits_reset_at column to profiles
--    Tracks when the user's monthly credits should refresh
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ;

-- Set an initial reset date of 1 month from now for all existing users
UPDATE profiles
SET credits_reset_at = NOW() + INTERVAL '1 month'
WHERE credits_reset_at IS NULL;

-- 2. Ensure credits can never go negative (DB-level safety net)
--    Even if application logic has a bug, the DB will reject it
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS credits_non_negative;

ALTER TABLE profiles
  ADD CONSTRAINT credits_non_negative CHECK (credits_remaining >= 0);

-- 3. Create atomic decrement function
--    Decrements credits_remaining by 1 ONLY IF > 0, in one operation.
--    This prevents race conditions (two requests spending the last credit).
--    Returns: { credits_remaining INT, success BOOL }
CREATE OR REPLACE FUNCTION decrement_credit(p_user_id UUID)
RETURNS TABLE(credits_remaining INTEGER, success BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as DB owner, bypasses RLS for this one update
AS $$
DECLARE
  v_new_credits INTEGER;
BEGIN
  -- Attempt atomic decrement only when credits > 0
  UPDATE profiles
  SET credits_remaining = profiles.credits_remaining - 1
  WHERE id = p_user_id
    AND profiles.credits_remaining > 0
  RETURNING profiles.credits_remaining INTO v_new_credits;

  IF FOUND THEN
    -- Decrement succeeded
    RETURN QUERY SELECT v_new_credits, TRUE;
  ELSE
    -- User had 0 credits — return current balance without modifying
    RETURN QUERY
      SELECT p.credits_remaining, FALSE
      FROM profiles p
      WHERE p.id = p_user_id;
  END IF;
END;
$$;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION decrement_credit(UUID) TO authenticated;
