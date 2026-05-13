-- ============================================================
-- Council App — Referral System Migration
-- ============================================================
-- Run this in the Supabase SQL Editor.
-- Adds referral_code and referred_by to profiles.
-- ============================================================

-- 1. Add referral columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);

-- 2. Generate referral codes for all existing users who don't have one
-- Uses a random 8-char alphanumeric code
UPDATE public.profiles
SET referral_code = substr(md5(random()::text || id::text), 1, 8)
WHERE referral_code IS NULL;

-- 3. Make referral_code NOT NULL going forward
ALTER TABLE public.profiles
  ALTER COLUMN referral_code SET NOT NULL;

-- 4. Auto-generate referral code for new signups
-- Update the existing handle_new_user trigger function to include referral_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    substr(md5(random()::text || NEW.id::text), 1, 8)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    referral_code = COALESCE(profiles.referral_code, EXCLUDED.referral_code);
  RETURN NEW;
END;
$$;

-- 5. Index for fast referral code lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON public.profiles (referral_code);

-- 6. Index for counting referrals per user
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by
  ON public.profiles (referred_by);
