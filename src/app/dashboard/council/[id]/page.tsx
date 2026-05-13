'use client'

import { ReactNode, use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Download,
  Link2,
  Loader2,
  Plus,
  Share2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { trackEvent } from '@/lib/analytics'

type CouncilStatus =
  | 'pending'
  | 'running'
  | 'advisors'
  | 'review'
  | 'chairman'
  | 'complete'
  | 'failed'

type JsonMap = Record<string, string>

type OutcomeValue = 'positive' | 'negative' | 'mixed' | 'pending'

interface Outcome {
  id: string
  outcome: OutcomeValue
  outcome_details: string | null
  recorded_at: string
}

interface Council {
  id: string
  title: string | null
  question: string
  status: CouncilStatus
  template_id: string | null
  share_token: string | null
  advisor_responses: JsonMap | null
  reviews: JsonMap | null
  letter_map: JsonMap | null
  verdict: string | null
  created_at: string
  completed_at: string | null
}

const stages = [
  { key: 'running', label: 'Reading your question...' },
  { key: 'advisors', label: '5 advisors deliberating...' },
  { key: 'review', label: 'Anonymous peer review...' },
  { key: 'chairman', label: 'Chairman delivering verdict...' },
] as const

const statusStepIndex: Record<CouncilStatus, number> = {
  pending: 0,
  running: 0,
  advisors: 1,
  review: 2,
  chairman: 3,
  complete: 4,
  failed: 0,
}

const advisorModels = [
  'openai/gpt-5.5',
  'google/gemini-3.1-pro-preview',
  'anthropic/claude-sonnet-4.6',
  'x-ai/grok-4.3',
  'deepseek/deepseek-v4-pro',
]

function formatTemplateName(templateId: string | null) {
  if (!templateId) {
    return 'Custom Decision'
  }

  return templateId
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatElapsed(start?: string, end?: string | null) {
  if (!start) {
    return '0s'
  }

  const startMs = new Date(start).getTime()
  const endMs = end ? new Date(end).getTime() : Date.now()
  const totalSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function normalizeMap(value: unknown): JsonMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.entries(value as Record<string, unknown>).reduce<JsonMap>(
    (acc, [key, entry]) => {
      acc[key] = typeof entry === 'string' ? entry : JSON.stringify(entry)
      return acc
    },
    {}
  )
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }

    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }

    return part
  })
}

function MarkdownRenderer({
  content,
  prominent = false,
}: {
  content: string
  prominent?: boolean
}) {
  const blocks: ReactNode[] = []
  const lines = content.split(/\r?\n/)
  let listItems: string[] = []

  const flushList = () => {
    if (listItems.length === 0) {
      return
    }

    blocks.push(
      <ul
        key={`list-${blocks.length}`}
        className={clsx(
          'my-4 list-disc space-y-2 pl-5',
          prominent ? 'text-slate-100' : 'text-slate-300'
        )}
      >
        {listItems.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    )
    listItems = []
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim()

    if (!line) {
      flushList()
      return
    }

    const listMatch = line.match(/^[-*]\s+(.+)$/)
    if (listMatch) {
      listItems.push(listMatch[1])
      return
    }

    flushList()

    if (line.startsWith('### ')) {
      blocks.push(
        <h3 key={blocks.length} className="mb-3 mt-6 text-xl font-semibold text-white">
          {renderInlineMarkdown(line.slice(4))}
        </h3>
      )
      return
    }

    if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={blocks.length} className="mb-4 mt-7 text-2xl font-bold text-white">
          {renderInlineMarkdown(line.slice(3))}
        </h2>
      )
      return
    }

    if (line.startsWith('# ')) {
      blocks.push(
        <h1 key={blocks.length} className="mb-4 mt-8 text-3xl font-bold text-white">
          {renderInlineMarkdown(line.slice(2))}
        </h1>
      )
      return
    }

    blocks.push(
      <p
        key={blocks.length}
        className={clsx(
          'my-4 leading-8',
          prominent ? 'text-lg text-slate-100' : 'text-slate-300'
        )}
      >
        {renderInlineMarkdown(line)}
      </p>
    )
  })

  flushList()

  return <div>{blocks}</div>
}

function AccordionItem({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800/40">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-800"
      >
        <span>
          <span className="block font-semibold text-white">{title}</span>
          {subtitle && (
            <span className="mt-1 block text-sm text-slate-400">{subtitle}</span>
          )}
        </span>
        <ChevronDown
          size={20}
          className={clsx(
            'shrink-0 text-slate-400 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && <div className="border-t border-slate-700 px-5 py-5">{children}</div>}
    </div>
  )
}

function ProgressStep({
  label,
  index,
  activeIndex,
}: {
  label: string
  index: number
  activeIndex: number
}) {
  const isDone = index < activeIndex
  const isActive = index === activeIndex

  return (
    <div
      className={clsx(
        'flex items-center gap-4 rounded-lg border px-4 py-4 transition-all',
        isActive
          ? 'animate-pulse border-purple-500/60 bg-purple-500/10'
          : 'border-slate-700 bg-slate-900/50'
      )}
    >
      <span
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          isDone
            ? 'bg-purple-500 text-white'
            : isActive
              ? 'bg-purple-500/20 text-purple-300'
              : 'bg-slate-800 text-slate-500'
        )}
      >
        {isDone ? (
          <Check size={18} strokeWidth={3} />
        ) : isActive ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          index + 1
        )}
      </span>
      <span className={clsx('font-medium', isActive ? 'text-white' : 'text-slate-300')}>
        {label}
      </span>
    </div>
  )
}

export default function CouncilResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [council, setCouncil] = useState<Council | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [now, setNow] = useState(0)
  const [isGeneratingShare, setIsGeneratingShare] = useState(false)
  const [isRemovingShare, setIsRemovingShare] = useState(false)
  const [shareUrlOverride, setShareUrlOverride] = useState<string | null>(null)
  const completionTrackedCouncilIdRef = useRef<string | null>(null)
  const appOrigin =
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''

  const fetchCouncil = useCallback(async () => {
    try {
      const response = await fetch(`/api/councils/${id}`, {
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load council')
      }

      setCouncil(payload.council)
      setError(null)
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : 'Unable to load council'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchCouncil()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [fetchCouncil])

  useEffect(() => {
    if (!council || council.status === 'complete' || council.status === 'failed') {
      return
    }

    const interval = window.setInterval(() => {
      void fetchCouncil()
    }, 2000)

    return () => window.clearInterval(interval)
  }, [council, fetchCouncil])

  useEffect(() => {
    const timeout = window.setTimeout(() => setNow(Date.now()), 0)
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!council || council.status !== 'complete') {
      return
    }

    if (completionTrackedCouncilIdRef.current === council.id) {
      return
    }

    completionTrackedCouncilIdRef.current = council.id

    trackEvent('council_completed', {
      council_id: council.id,
      template: formatTemplateName(council.template_id),
      elapsed_seconds: Math.max(
        0,
        Math.floor(
          (new Date(council.completed_at || council.created_at).getTime() -
            new Date(council.created_at).getTime()) /
            1000
        )
      ),
    })
  }, [council])

  const advisorResponses = useMemo(
    () => normalizeMap(council?.advisor_responses),
    [council?.advisor_responses]
  )
  const reviews = useMemo(() => normalizeMap(council?.reviews), [council?.reviews])
  const letterMap = useMemo(
    () => normalizeMap(council?.letter_map),
    [council?.letter_map]
  )

  const elapsed = council
    ? formatElapsed(council.created_at, council.completed_at || undefined)
    : '0s'
  const liveElapsed = council
    ? formatElapsed(
        council.created_at,
        council.completed_at || (now ? new Date(now).toISOString() : undefined)
      )
    : '0s'

  const title = council?.title || 'Council deliberation'
  const activeStep = council ? statusStepIndex[council.status] : 0
  const shareUrl = council?.share_token
    ? shareUrlOverride ||
      `${appOrigin.replace(/\/+$/, '')}/shared/${council.share_token}`
    : null

  const handleDownloadPdf = () => {
    trackEvent('pdf_downloaded', {
      council_id: id,
    })
    window.location.href = `/api/councils/${id}/pdf`
  }

  const handleGenerateShareLink = async () => {
    setIsGeneratingShare(true)
    try {
      const response = await fetch(`/api/councils/${id}/share`, {
        method: 'POST',
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to generate share link')
      }

      const shareToken = payload?.shareToken as string | undefined
      const generatedShareUrl = payload?.shareUrl as string | undefined

      if (!shareToken || !generatedShareUrl) {
        throw new Error('Share link was generated, but data was incomplete')
      }

      setCouncil((current) =>
        current ? { ...current, share_token: shareToken } : current
      )
      setShareUrlOverride(generatedShareUrl)
      toast.success('Share link created')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate share link'
      )
    } finally {
      setIsGeneratingShare(false)
    }
  }

  const handleRemoveShareLink = async () => {
    setIsRemovingShare(true)
    try {
      const response = await fetch(`/api/councils/${id}/share`, {
        method: 'DELETE',
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to remove share link')
      }

      setCouncil((current) =>
        current ? { ...current, share_token: null } : current
      )
      setShareUrlOverride(null)
      toast.success('Share link removed')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove share link'
      )
    } finally {
      setIsRemovingShare(false)
    }
  }

  const handleCopyShareLink = async () => {
    if (!shareUrl) {
      return
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = shareUrl
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      toast.success('Share URL copied')
    } catch {
      toast.error('Unable to copy share URL')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-full bg-slate-900 px-5 py-8 text-slate-100 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-purple-300" />
        </div>
      </div>
    )
  }

  if (error || council?.status === 'failed') {
    return (
      <div className="min-h-full bg-slate-900 px-5 py-8 text-slate-100 sm:px-8">
        <div className="mx-auto max-w-3xl rounded-lg border border-red-500/40 bg-red-950/20 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-300">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white">Council failed</h1>
          <p className="mt-3 text-slate-300">
            {error || 'The council could not complete its deliberation.'}
          </p>
          <button
            type="button"
            onClick={() => router.push('/dashboard/new-council')}
            className="mt-6 rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-500"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!council) {
    return null
  }

  if (council.status !== 'complete') {
    return (
      <div className="min-h-full bg-slate-900 px-5 py-8 text-slate-100 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-purple-300">
              Council Running
            </p>
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            <p className="mt-3 text-slate-400">
              Elapsed time:{' '}
              <span className="font-semibold text-purple-200">{liveElapsed}</span>
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 shadow-2xl shadow-purple-950/10">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Your advisors are working
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  This page checks for updates every 2 seconds.
                </p>
              </div>
              <Loader2 size={24} className="animate-spin text-purple-300" />
            </div>

            <div className="space-y-3">
              {stages.map((stage, index) => (
                <ProgressStep
                  key={stage.key}
                  label={stage.label}
                  index={index}
                  activeIndex={activeStep}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-900 px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-purple-300">
              Council Verdict
            </p>
            <h1 className="max-w-3xl text-3xl font-bold text-white sm:text-4xl">
              {title}
            </h1>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
              <span>{formatTemplateName(council.template_id)}</span>
              <span>{formatDateTime(council.created_at)}</span>
              <span>Elapsed {elapsed}</span>
            </div>
          </div>

          <div className="flex max-w-full flex-col items-start gap-3 xl:items-end">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-2 rounded-lg border border-purple-500/50 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-100 transition-colors hover:bg-purple-500/20"
              >
                <Download size={16} />
                Download PDF
              </button>
              <Link
                href="/dashboard/new-council"
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
              >
                <Plus size={16} />
                New Council
              </Link>
              <Link
                href="/dashboard/decisions"
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
              >
                Back to Archive
              </Link>
            </div>

            {shareUrl ? (
              <div className="w-full rounded-lg border border-slate-700 bg-slate-800/70 p-3 xl:min-w-[420px]">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-purple-300">
                  <Link2 size={13} />
                  Share URL
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={shareUrl}
                    readOnly
                    className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-purple-400 hover:text-white"
                  >
                    <Copy size={13} />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveShareLink}
                    disabled={isRemovingShare}
                    className="rounded-md border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isRemovingShare ? 'Removing...' : 'Remove Share Link'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateShareLink}
                disabled={isGeneratingShare}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-purple-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isGeneratingShare ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Share2 size={16} />
                )}
                {isGeneratingShare ? 'Generating...' : 'Generate Share Link'}
              </button>
            )}
          </div>
        </div>

        <section className="mb-10 rounded-lg border border-purple-500/50 border-l-purple-400 border-l-4 bg-gradient-to-br from-purple-950/35 via-slate-800/80 to-slate-900 p-6 shadow-2xl shadow-purple-950/25 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-purple-300 shadow-lg shadow-purple-400/50" />
            <h2 className="text-2xl font-bold text-white">Chairman&apos;s Verdict</h2>
          </div>
          <MarkdownRenderer
            content={council.verdict || 'No verdict was recorded.'}
            prominent
          />
        </section>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.65fr)]">
          <section>
            <h2 className="mb-4 text-xl font-bold text-white">
              Advisor Responses
            </h2>
            <div className="space-y-3">
              {Object.entries(advisorResponses).length > 0 ? (
                Object.entries(advisorResponses).map(([name, response], index) => (
                  <AccordionItem
                    key={name}
                    title={name}
                    subtitle={advisorModels[index] || 'Advisor model'}
                    defaultOpen={index === 0}
                  >
                    <MarkdownRenderer content={response} />
                  </AccordionItem>
                ))
              ) : (
                <p className="rounded-lg border border-slate-700 bg-slate-800/40 p-5 text-slate-400">
                  No advisor responses recorded.
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-bold text-white">Peer Reviews</h2>
            <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4 text-sm text-slate-400">
              <span className="font-semibold text-slate-200">
                Anonymization map:
              </span>{' '}
              {Object.entries(letterMap).length > 0
                ? Object.entries(letterMap)
                    .map(([letter, advisor]) => `${letter} = ${advisor}`)
                    .join(', ')
                : 'No map recorded.'}
            </div>

            <div className="space-y-3">
              {Object.entries(reviews).length > 0 ? (
                Object.entries(reviews).map(([name, review], index) => (
                  <AccordionItem
                    key={name}
                    title={`Review by ${name}`}
                    subtitle={advisorModels[index] || 'Reviewer model'}
                  >
                    <MarkdownRenderer content={review} />
                  </AccordionItem>
                ))
              ) : (
                <p className="rounded-lg border border-slate-700 bg-slate-800/40 p-5 text-slate-400">
                  No peer reviews recorded.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Outcome Tracking Section */}
        <OutcomeSection councilId={id} />
      </div>
    </div>
  )
}

// ============================================================
// Outcome Tracking Component
// ============================================================

const outcomeOptions: Array<{
  value: OutcomeValue
  emoji: string
  label: string
}> = [
  { value: 'positive', emoji: '👍', label: 'Good call' },
  { value: 'negative', emoji: '👎', label: 'Bad call' },
  { value: 'mixed', emoji: '🤝', label: 'Mixed' },
  { value: 'pending', emoji: '⏳', label: 'Too early to tell' },
]

const outcomeBadgeStyles: Record<OutcomeValue, string> = {
  positive: 'border-green-500/40 bg-green-500/15 text-green-200',
  negative: 'border-red-500/40 bg-red-500/15 text-red-200',
  mixed: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-200',
  pending: 'border-slate-500/40 bg-slate-500/15 text-slate-200',
}

const outcomeLabels: Record<OutcomeValue, string> = {
  positive: '👍 Good call',
  negative: '👎 Bad call',
  mixed: '🤝 Mixed results',
  pending: '⏳ Too early to tell',
}

function OutcomeSection({ councilId }: { councilId: string }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeValue | null>(null)
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchOutcome = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data } = await supabase
          .from('decision_outcomes')
          .select('id, outcome, outcome_details, recorded_at')
          .eq('council_id', councilId)
          .single()

        if (data) {
          setOutcome(data as Outcome)
        }
      } catch {
        // No outcome yet
      } finally {
        setIsLoading(false)
      }
    }

    void fetchOutcome()
  }, [councilId])

  const handleSubmit = async () => {
    if (!selectedOutcome) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/councils/${councilId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: selectedOutcome,
          details: details.trim(),
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save outcome')
      }

      setOutcome({
        id: 'new',
        outcome: selectedOutcome,
        outcome_details: details.trim() || null,
        recorded_at: new Date().toISOString(),
      })
      toast.success('Outcome recorded')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save outcome',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return null

  // --- Outcome already recorded ---
  if (outcome) {
    return (
      <section className="mt-10 rounded-lg border border-slate-700 bg-slate-800/40 p-6">
        <h2 className="mb-4 text-xl font-bold text-white">Decision Outcome</h2>
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={clsx(
              'inline-flex rounded-full border px-4 py-2 text-sm font-semibold',
              outcomeBadgeStyles[outcome.outcome],
            )}
          >
            {outcomeLabels[outcome.outcome]}
          </span>
          <span className="text-sm text-slate-400">
            Recorded{' '}
            {new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }).format(new Date(outcome.recorded_at))}
          </span>
        </div>
        {outcome.outcome_details && (
          <p className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-slate-300">
            {outcome.outcome_details}
          </p>
        )}
      </section>
    )
  }

  // --- No outcome yet — show the form ---
  return (
    <section className="mt-10 rounded-lg border border-slate-700 bg-slate-800/40 p-6">
      <h2 className="mb-2 text-xl font-bold text-white">
        How did this decision turn out?
      </h2>
      <p className="mb-5 text-sm text-slate-400">
        Recording outcomes helps Council learn what kinds of advice work best for you.
      </p>

      <div className="mb-5 flex flex-wrap gap-3">
        {outcomeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setSelectedOutcome(option.value)}
            className={clsx(
              'rounded-lg border px-5 py-3 text-sm font-semibold transition-all',
              selectedOutcome === option.value
                ? 'border-purple-500 bg-purple-500/20 text-purple-100 ring-2 ring-purple-500/30'
                : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500 hover:bg-slate-800',
            )}
          >
            <span className="mr-2 text-lg">{option.emoji}</span>
            {option.label}
          </button>
        ))}
      </div>

      {selectedOutcome && (
        <>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Optional: share what happened, what you learned..."
            rows={3}
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {isSubmitting ? 'Saving...' : 'Record Outcome'}
          </button>
        </>
      )}
    </section>
  )
}
