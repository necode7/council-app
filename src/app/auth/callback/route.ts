import { type NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl
  const code = requestUrl.searchParams.get('code')
  const referralCode = requestUrl.searchParams.get('ref')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', requestUrl.origin))
  }

  const supabase = await createClient()
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
    )
  }

  // Send welcome email for new sign-ups (created_at ≈ now means first session)
  const user = sessionData?.user
  if (user?.email && user.created_at) {
    const createdMs = new Date(user.created_at).getTime()
    const isNew = Date.now() - createdMs < 60_000
    if (isNew) {
      sendEmail({ to: user.email, template: 'welcome' }).catch(() => {})
    }
  }

  // Apply referral code if present (Google OAuth flow)
  if (referralCode) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Look up the referrer
        const { data: referrer } = await supabase
          .from('profiles')
          .select('id, credits_remaining')
          .eq('referral_code', referralCode.trim().toLowerCase())
          .single()

        if (referrer && referrer.id !== user.id) {
          // Check if user already has a referrer
          const { data: myProfile } = await supabase
            .from('profiles')
            .select('referred_by, credits_remaining')
            .eq('id', user.id)
            .single()

          if (myProfile && !myProfile.referred_by) {
            const bonus = 3

            // Set referred_by + give new user bonus
            await supabase
              .from('profiles')
              .update({
                referred_by: referrer.id,
                credits_remaining: (myProfile.credits_remaining ?? 0) + bonus,
              })
              .eq('id', user.id)

            // Give referrer bonus
            await supabase
              .from('profiles')
              .update({
                credits_remaining: referrer.credits_remaining + bonus,
              })
              .eq('id', referrer.id)
          }
        }
      }
    } catch {
      // Referral application failed silently — don't block the login flow
    }
  }

  return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
}
