'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, Check, ChevronDown, Copy, Loader2, Share2 } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/analytics'

type Plan = 'free' | 'pro' | 'team'

type DomainOption =
  | 'Technology'
  | 'Finance'
  | 'Legal'
  | 'Healthcare'
  | 'Real Estate'
  | 'Consulting'
  | 'Other'

const domainOptions: DomainOption[] = [
  'Technology',
  'Finance',
  'Legal',
  'Healthcare',
  'Real Estate',
  'Consulting',
  'Other',
]

function planBadgeClasses(plan: Plan) {
  if (plan === 'pro') {
    return 'border-blue-500/40 bg-blue-500/15 text-blue-200'
  }

  if (plan === 'team') {
    return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
  }

  return 'border-slate-600 bg-slate-700/70 text-slate-200'
}

function planLabel(plan: Plan) {
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeletingDecisions, setIsDeletingDecisions] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)

  const [fullName, setFullName] = useState('')
  const [domain, setDomain] = useState<DomainOption | ''>('')
  const [bio, setBio] = useState('')
  const [plan, setPlan] = useState<Plan>('free')
  const [creditsRemaining, setCreditsRemaining] = useState(0)
  const [creditsResetAt, setCreditsResetAt] = useState<string | null>(null)
  const [deleteDecisionsConfirmed, setDeleteDecisionsConfirmed] = useState(false)
  const [deleteAccountConfirmed, setDeleteAccountConfirmed] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [referralCount, setReferralCount] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
          throw new Error('You need to be signed in to view settings')
        }

        setUserId(user.id)

        const { data: profile, error } = await supabase
          .from('profiles')
          .select(
            'full_name, domain, bio, plan, credits_remaining, credits_reset_at, referral_code'
          )
          .eq('id', user.id)
          .single()

        if (error || !profile) {
          throw new Error('Failed to load your profile')
        }

        setFullName(profile.full_name || '')
        setDomain((profile.domain as DomainOption | null) || '')
        setBio(profile.bio || '')
        setPlan((profile.plan as Plan) || 'free')
        setCreditsRemaining(profile.credits_remaining ?? 0)
        setCreditsResetAt(profile.credits_reset_at || null)
        setReferralCode(profile.referral_code || '')

        // Count successful referrals
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('referred_by', user.id)
        setReferralCount(count ?? 0)
      } catch (loadError) {
        toast.error(
          loadError instanceof Error ? loadError.message : 'Failed to load settings'
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfile()
  }, [supabase])

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId) {
      toast.error('Unable to find your account. Please sign in again.')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          domain: domain || null,
          bio: bio.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (error) {
        throw error
      }

      toast.success('Profile updated')
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : 'Failed to save profile'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteDecisions = async () => {
    if (!userId || !deleteDecisionsConfirmed) {
      return
    }

    setIsDeletingDecisions(true)
    try {
      const { error } = await supabase
        .from('councils')
        .delete()
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      setDeleteDecisionsConfirmed(false)
      toast.success('All decisions deleted')
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete decisions'
      )
    } finally {
      setIsDeletingDecisions(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteAccountConfirmed) {
      return
    }

    setIsDeletingAccount(true)
    try {
      toast('Coming soon: account deletion flow')
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const resetDateLabel = creditsResetAt
    ? new Date(creditsResetAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Not available'

  const bioCharsLeft = 200 - bio.length

  return (
    <div className="min-h-full bg-slate-900 px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Settings</h1>
          <p className="mt-2 text-slate-400">
            Manage your profile, plan, and account controls.
          </p>
        </header>

        <section className="rounded-lg border border-slate-700 bg-slate-800/45 p-6">
          <h2 className="text-xl font-bold text-white">Profile</h2>
          <p className="mt-1 text-sm text-slate-400">
            This context helps your council personalize advice.
          </p>

          {isLoading ? (
            <div className="mt-8 flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-slate-300" />
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Full name
                </span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  type="text"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
                  placeholder="Your name"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Domain / Industry
                </span>
                <select
                  value={domain}
                  onChange={(event) =>
                    setDomain((event.target.value as DomainOption) || '')
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none transition-colors focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
                >
                  <option value="">Select a domain</option>
                  {domainOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Short bio
                </span>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value.slice(0, 200))}
                  rows={4}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
                  placeholder="Share your role and what decisions you work on."
                />
                <p
                  className={clsx(
                    'mt-2 text-right text-xs',
                    bioCharsLeft < 20 ? 'text-yellow-300' : 'text-slate-500'
                  )}
                >
                  {bio.length}/200
                </p>
              </label>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {isSaving && <Loader2 size={16} className="animate-spin" />}
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </form>
          )}
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-800/45 p-6">
          <h2 className="text-xl font-bold text-white">Plan & Credits</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                Current plan
              </p>
              <span
                className={clsx(
                  'inline-flex rounded-full border px-3 py-1 text-sm font-semibold',
                  planBadgeClasses(plan)
                )}
              >
                {planLabel(plan)}
              </span>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                Credits remaining
              </p>
              <p className="text-2xl font-bold text-white">{creditsRemaining}</p>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                Credits reset
              </p>
              <p className="text-sm font-semibold text-slate-200">{resetDateLabel}</p>
            </div>
          </div>

          {plan === 'free' && (
            <button
              type="button"
              onClick={() => {
                trackEvent('plan_upgraded', {
                  source: 'settings',
                  plan_target: 'pro',
                  action: 'clicked_upgrade',
                })
                toast('Coming soon')
              }}
              className="mt-5 rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-purple-500"
            >
              Upgrade to Pro
            </button>
          )}
        </section>

        {/* Referral Section */}
        <section className="rounded-lg border border-slate-700 bg-slate-800/45 p-6">
          <div className="mb-1 flex items-center gap-2">
            <Share2 size={20} className="text-purple-300" />
            <h2 className="text-xl font-bold text-white">Referrals</h2>
          </div>
          <p className="mb-5 text-sm text-slate-400">
            Invite friends — you both get <span className="font-semibold text-purple-300">3 bonus credits</span> when they sign up.
          </p>

          {referralCode && (
            <>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Your referral link
              </label>
              <div className="mb-4 flex items-stretch gap-2">
                <input
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/ref/${referralCode}`}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      `${window.location.origin}/ref/${referralCode}`
                    )
                    trackEvent('referral_shared', {
                      channel: 'copy',
                    })
                    setCopied(true)
                    toast.success('Link copied!')
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors',
                    copied
                      ? 'border-green-500/50 bg-green-500/15 text-green-200'
                      : 'border-purple-500/50 bg-purple-500/10 text-purple-100 hover:bg-purple-500/20'
                  )}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="mb-5 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Successful referrals</p>
                <p className="mt-1 text-2xl font-bold text-white">{referralCount}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {referralCount > 0
                    ? `You've earned ${referralCount * 3} bonus credits from referrals`
                    : 'Share your link to start earning bonus credits'}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `I use Council — an AI advisory board that gives structured, multi-perspective analysis on tough decisions. Try it free:\n${typeof window !== 'undefined' ? window.location.origin : ''}/ref/${referralCode}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackEvent('referral_shared', {
                      channel: 'x',
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Share on X
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                    `${typeof window !== 'undefined' ? window.location.origin : ''}/ref/${referralCode}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackEvent('referral_shared', {
                      channel: 'linkedin',
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  Share on LinkedIn
                </a>
              </div>
            </>
          )}
        </section>

        <section className="rounded-lg border border-red-500/35 bg-red-950/20 p-6">
          <button
            type="button"
            onClick={() => setDangerOpen((open) => !open)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-300" />
              <span className="text-xl font-bold text-red-200">Danger Zone</span>
            </span>
            <ChevronDown
              size={20}
              className={clsx(
                'text-red-300 transition-transform',
                dangerOpen && 'rotate-180'
              )}
            />
          </button>

          {dangerOpen && (
            <div className="mt-5 space-y-5">
              <div className="rounded-lg border border-red-500/35 bg-red-950/25 p-4">
                <p className="font-semibold text-red-100">Delete all my decisions</p>
                <p className="mt-1 text-sm text-red-200/80">
                  Permanently removes your entire council archive.
                </p>
                <label className="mt-3 flex items-center gap-2 text-sm text-red-200">
                  <input
                    type="checkbox"
                    checked={deleteDecisionsConfirmed}
                    onChange={(event) =>
                      setDeleteDecisionsConfirmed(event.target.checked)
                    }
                    className="h-4 w-4 accent-red-500"
                  />
                  I understand this cannot be undone.
                </label>
                <button
                  type="button"
                  onClick={handleDeleteDecisions}
                  disabled={!deleteDecisionsConfirmed || isDeletingDecisions}
                  className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-900/50"
                >
                  {isDeletingDecisions ? 'Deleting...' : 'Delete all my decisions'}
                </button>
              </div>

              <div className="rounded-lg border border-red-500/35 bg-red-950/25 p-4">
                <p className="font-semibold text-red-100">Delete my account</p>
                <p className="mt-1 text-sm text-red-200/80">
                  This will remove account access and all associated data.
                </p>
                <label className="mt-3 flex items-center gap-2 text-sm text-red-200">
                  <input
                    type="checkbox"
                    checked={deleteAccountConfirmed}
                    onChange={(event) =>
                      setDeleteAccountConfirmed(event.target.checked)
                    }
                    className="h-4 w-4 accent-red-500"
                  />
                  I confirm I want to delete my account.
                </label>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={!deleteAccountConfirmed || isDeletingAccount}
                  className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-900/50"
                >
                  {isDeletingAccount ? 'Deleting...' : 'Delete my account'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
