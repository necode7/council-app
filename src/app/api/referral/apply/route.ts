/**
 * API Route: /api/referral/apply
 *
 * POST — Apply a referral code after signup
 * Called from the auth callback when a referral code is in the session.
 * Awards 3 bonus credits to BOTH the referrer and the new user.
 */

import { createClient } from '@/lib/supabase/server'
import { sanitizeInput } from '@/lib/sanitize'
import { AuthError, AppError, ValidationError, errorResponse } from '@/lib/errors'

const REFERRAL_BONUS = 3

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // --- Authenticate ---
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new AuthError()

    // --- Parse body ---
    const body = await request.json()
    const { referral_code } = body as { referral_code?: string }

    if (!referral_code || typeof referral_code !== 'string' || referral_code.trim().length === 0) {
      throw new ValidationError('Referral code is required')
    }

    const code = sanitizeInput(referral_code).toLowerCase()

    // --- Check if this user already has a referrer ---
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('referred_by')
      .eq('id', user.id)
      .single()

    if (myProfile?.referred_by) {
      throw new AppError('Referral already applied', 'ALREADY_REFERRED', 409)
    }

    // --- Find the referrer ---
    const { data: referrer, error: referrerError } = await supabase
      .from('profiles')
      .select('id, credits_remaining')
      .eq('referral_code', code)
      .single()

    if (referrerError || !referrer) {
      throw new AppError('Invalid referral code', 'INVALID_CODE', 404)
    }

    // --- Can't refer yourself ---
    if (referrer.id === user.id) {
      throw new ValidationError('Cannot use your own referral code')
    }

    // --- Apply referral: set referred_by + give new user bonus credits ---
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('credits_remaining')
      .eq('id', user.id)
      .single()

    const currentCredits = currentProfile?.credits_remaining ?? 0

    await supabase
      .from('profiles')
      .update({
        referred_by: referrer.id,
        credits_remaining: currentCredits + REFERRAL_BONUS,
      })
      .eq('id', user.id)

    // --- Give referrer bonus credits ---
    await supabase
      .from('profiles')
      .update({
        credits_remaining: referrer.credits_remaining + REFERRAL_BONUS,
      })
      .eq('id', referrer.id)

    return Response.json({
      status: 'applied',
      bonus_credits: REFERRAL_BONUS,
      message: `You and your referrer each received ${REFERRAL_BONUS} bonus credits!`,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
