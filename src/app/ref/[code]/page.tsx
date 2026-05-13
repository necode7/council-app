/**
 * Referral redirect page: /ref/[code]
 *
 * Redirects to /signup?ref=<code> so the signup page can capture
 * the referral code and apply it after account creation.
 */

import { redirect } from 'next/navigation'

export default async function ReferralRedirectPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  redirect(`/signup?ref=${encodeURIComponent(code)}`)
}
