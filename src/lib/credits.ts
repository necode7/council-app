import 'server-only'
import { createClient } from '@/lib/supabase/server'

// Credits granted per plan on each monthly reset
const PLAN_CREDITS: Record<string, number> = {
  free: 5,
  pro: 30,
  team: 200,
}

// ─────────────────────────────────────────────────────────────
// checkCredits
// Returns whether the user has credits and their current state
// ─────────────────────────────────────────────────────────────
export async function checkCredits(userId: string): Promise<{
  hasCredits: boolean
  remaining: number
  plan: string
  upgradeUrl: string
}> {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('credits_remaining, plan')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    // Fail open — let the pipeline handle auth/profile errors separately
    return { hasCredits: false, remaining: 0, plan: 'free', upgradeUrl: '/dashboard/settings' }
  }

  return {
    hasCredits: profile.credits_remaining > 0,
    remaining: profile.credits_remaining,
    plan: profile.plan ?? 'free',
    upgradeUrl: '/dashboard/settings?tab=billing',
  }
}

// ─────────────────────────────────────────────────────────────
// deductCredit
// Atomically decrements credits_remaining by 1.
// Uses an RPC so the check (> 0) and the decrement happen in one
// DB round-trip — prevents race conditions or negative balances.
// Returns false if the user had no credits left to spend.
// ─────────────────────────────────────────────────────────────
export async function deductCredit(userId: string): Promise<{
  success: boolean
  remaining: number
}> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('decrement_credit', {
    p_user_id: userId,
  })

  if (error) {
    console.error('deductCredit RPC error:', error)
    return { success: false, remaining: 0 }
  }

  // RPC returns a single row: { success, credits_remaining }
  const row = Array.isArray(data) ? data[0] : data
  return {
    success: row?.success ?? false,
    remaining: row?.credits_remaining ?? 0,
  }
}

// ─────────────────────────────────────────────────────────────
// resetCreditsIfNeeded
// Checks if the user's monthly reset date has passed.
// If yes, resets credits to the plan allowance and pushes the
// reset date forward by one month.
// Safe to call on every request — it's a no-op when not needed.
// ─────────────────────────────────────────────────────────────
export async function resetCreditsIfNeeded(userId: string): Promise<void> {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan, credits_reset_at')
    .eq('id', userId)
    .single()

  if (error || !profile) return

  const now = new Date()
  const resetAt = profile.credits_reset_at ? new Date(profile.credits_reset_at) : null

  // Nothing to do if reset date is in the future
  if (resetAt && resetAt > now) return

  // Reset has passed (or was never set) — refill credits
  const plan = profile.plan ?? 'free'
  const newCredits = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free

  // Next reset is 1 month from now
  const nextReset = new Date(now)
  nextReset.setMonth(nextReset.getMonth() + 1)

  await supabase
    .from('profiles')
    .update({
      credits_remaining: newCredits,
      credits_reset_at: nextReset.toISOString(),
    })
    .eq('id', userId)
}
