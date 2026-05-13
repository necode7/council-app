'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Archive, Loader2, Search } from 'lucide-react'
import { clsx } from 'clsx'

type CouncilStatus =
  | 'pending'
  | 'running'
  | 'advisors'
  | 'review'
  | 'chairman'
  | 'complete'
  | 'failed'

interface Council {
  id: string
  title: string | null
  question: string
  status: CouncilStatus
  template_id: string | null
  created_at: string
  verdict: string | null
}

const templateLabels: Record<string, string> = {
  'strategic-decision': 'Strategic Decision',
  'contract-review': 'Contract Review',
  'investment-analysis': 'Investment Analysis',
  'audit-risk-assessment': 'Audit Risk Assessment',
  'custom-decision': 'Custom',
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function titleCaseFromSlug(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatDecisionTitle(title: string | null) {
  if (!title || title.trim().length === 0) {
    return 'Untitled Decision'
  }

  return titleCaseFromSlug(title)
}

function formatTemplateLabel(templateId: string | null) {
  if (!templateId) {
    return 'Custom'
  }

  if (templateLabels[templateId]) {
    return templateLabels[templateId]
  }

  if (isUuid(templateId)) {
    return 'Template'
  }

  return titleCaseFromSlug(templateId)
}

function formatRelativeTime(value: string) {
  const date = new Date(value).getTime()
  const now = Date.now()
  const diffSeconds = Math.round((date - now) / 1000)
  const abs = Math.abs(diffSeconds)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (abs < 60) {
    return rtf.format(diffSeconds, 'second')
  }

  const diffMinutes = Math.round(diffSeconds / 60)
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute')
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour')
  }

  const diffDays = Math.round(diffHours / 24)
  if (Math.abs(diffDays) < 7) {
    return rtf.format(diffDays, 'day')
  }

  const diffWeeks = Math.round(diffDays / 7)
  if (Math.abs(diffWeeks) < 5) {
    return rtf.format(diffWeeks, 'week')
  }

  const diffMonths = Math.round(diffDays / 30)
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, 'month')
  }

  const diffYears = Math.round(diffDays / 365)
  return rtf.format(diffYears, 'year')
}

function previewVerdict(verdict: string | null) {
  if (!verdict || verdict.trim().length === 0) {
    return 'No verdict recorded yet.'
  }

  const compact = verdict.replace(/\s+/g, ' ').trim()
  if (compact.length <= 100) {
    return compact
  }

  return `${compact.slice(0, 100)}...`
}

function statusBadgeClasses(status: CouncilStatus) {
  if (status === 'complete') {
    return 'bg-green-500/15 text-green-300 border-green-500/30'
  }

  if (status === 'failed') {
    return 'bg-red-500/15 text-red-300 border-red-500/30'
  }

  return 'bg-yellow-500/15 text-yellow-200 border-yellow-500/30 animate-pulse'
}

function statusLabel(status: CouncilStatus) {
  if (status === 'running' || status === 'pending') {
    return 'Running'
  }

  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function DecisionsPage() {
  const [councils, setCouncils] = useState<Council[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadCouncils = async () => {
      try {
        const response = await fetch('/api/councils', {
          cache: 'no-store',
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load decisions')
        }

        setCouncils((payload?.councils || []) as Council[])
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : 'Failed to load decisions'
        setError(message)
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    }

    void loadCouncils()
  }, [])

  const filteredCouncils = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) {
      return councils
    }

    return councils.filter((council) => {
      const title = formatDecisionTitle(council.title).toLowerCase()
      const question = council.question.toLowerCase()
      return title.includes(term) || question.includes(term)
    })
  }, [councils, search])

  return (
    <div className="min-h-full bg-slate-900 px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              My Decisions
            </h1>
            <p className="mt-2 text-slate-400">
              Your council history, outcomes, and in-progress deliberations.
            </p>
          </div>

          <span className="inline-flex w-fit items-center rounded-full border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200">
            {councils.length} total
          </span>
        </header>

        <div className="mb-6">
          <label className="relative block">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="text"
              placeholder="Search by title or question..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-3 pl-10 pr-4 text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-slate-500"
            />
          </label>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-6 py-16 text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-slate-300" />
            <p className="mt-4 text-slate-400">Loading decisions...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-950/20 px-6 py-10 text-center">
            <p className="text-red-300">{error}</p>
          </div>
        ) : filteredCouncils.length === 0 && councils.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-6 py-16 text-center">
            <Archive size={60} className="mx-auto text-slate-500" />
            <h2 className="mt-5 text-2xl font-bold text-white">No decisions yet</h2>
            <p className="mt-2 text-slate-400">
              Run your first council to start building an archive.
            </p>
            <Link
              href="/dashboard/new-council"
              className="mt-6 inline-flex items-center rounded-lg bg-slate-100 px-5 py-3 font-semibold text-slate-900 transition-colors hover:bg-white"
            >
              Run your first council
            </Link>
          </div>
        ) : filteredCouncils.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-6 py-12 text-center">
            <p className="text-slate-300">No decisions match your search.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCouncils.map((council) => (
              <Link
                key={council.id}
                href={`/dashboard/council/${council.id}`}
                className="group block rounded-lg border border-slate-700 bg-slate-800/50 p-5 transition-all hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-800"
              >
                <div className="mb-3 flex flex-wrap items-start gap-3">
                  <h2 className="min-w-0 flex-1 text-xl font-semibold text-white group-hover:text-slate-100">
                    {formatDecisionTitle(council.title)}
                  </h2>

                  <span className="rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-300">
                    {formatTemplateLabel(council.template_id)}
                  </span>

                  <span
                    className={clsx(
                      'rounded-full border px-3 py-1 text-xs font-semibold',
                      statusBadgeClasses(council.status)
                    )}
                  >
                    {statusLabel(council.status)}
                  </span>
                </div>

                <p className="mb-3 text-sm text-slate-500">
                  {formatRelativeTime(council.created_at)}
                </p>

                <p className="text-slate-300">{previewVerdict(council.verdict)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
