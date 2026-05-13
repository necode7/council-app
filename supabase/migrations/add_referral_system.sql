-- ================================================================
-- Migration: Referral System (Phase 3 — Step 3.2)
-- ================================================================
-- Adds referral_code + referred_by columns to profiles.
-- Each user gets a unique 8-char referral code on signup.
-- Both referrer and referred user receive 3 bonus credits.
-- ================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by   UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Backfill referral codes for any existing users that don't have one.
-- Uses substring of MD5 to give 8 lowercase hex characters.
UPDATE profiles
SET    referral_code = LOWER(SUBSTRING(MD5(id::text || NOW()::text) FROM 1 FOR 8))
WHERE  referral_code IS NULL;

-- Make the auto-create trigger also generate a referral code for new users.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    LOWER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
