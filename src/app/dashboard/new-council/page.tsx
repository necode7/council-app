'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Check, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/analytics'

type TemplateId =
  | 'strategic-decision'
  | 'contract-review'
  | 'investment-analysis'
  | 'audit-risk-assessment'
  | 'custom-decision'

const templates: Array<{
  id: TemplateId
  icon: string
  title: string
  description: string
}> = [
  {
    id: 'strategic-decision',
    icon: '🎯',
    title: 'Strategic Decision',
    description: 'Evaluate choices that shape direction and priorities.',
  },
  {
    id: 'contract-review',
    icon: '📋',
    title: 'Contract Review',
    description: 'Surface risks, tradeoffs, and negotiation angles.',
  },
  {
    id: 'investment-analysis',
    icon: '📈',
    title: 'Investment Analysis',
    description: 'Pressure-test upside, downside, timing, and exposure.',
  },
  {
    id: 'audit-risk-assessment',
    icon: '🔍',
    title: 'Audit Risk Assessment',
    description: 'Identify control gaps and operational risk signals.',
  },
  {
    id: 'custom-decision',
    icon: '✨',
    title: 'Custom Decision',
    description: 'Start free-form with your own context and question.',
  },
]

const questionPlaceholder = `Council this:
Should we move forward with...

Context:
The situation is...

The real question:
What should we do, and what are we missing?`

export default function NewCouncilPage() {
  const router = useRouter()
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateId>('custom-decision')
  const [question, setQuestion] = useState('')
  const [stakes, setStakes] = useState('')
  const [leaning, setLeaning] = useState('')
  const [constraints, setConstraints] = useState('')
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const loadCredits = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('credits_remaining')
        .eq('id', user.id)
        .single()

      if (!error) {
        setCreditsRemaining(data?.credits_remaining ?? 0)
      }
    }

    void loadCredits()
  }, [])

  const selectedTemplateMeta = useMemo(
    () => templates.find((template) => template.id === selectedTemplate),
    [selectedTemplate]
  )

  const trimmedQuestion = question.trim()
  const canSubmit = trimmedQuestion.length > 0 && !isSubmitting

  const buildQuestionWithContext = () => {
    const contextLines = [
      stakes.trim() ? `What's at stake: ${stakes.trim()}` : null,
      leaning.trim() ? `Current leaning: ${leaning.trim()}` : null,
      constraints.trim() ? `Key constraints: ${constraints.trim()}` : null,
    ].filter(Boolean)

    if (contextLines.length === 0) {
      return trimmedQuestion
    }

    return `${trimmedQuestion}\n\nAdditional context:\n${contextLines.join('\n')}`
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!trimmedQuestion) {
      return
    }

    setIsSubmitting(true)

    try {
      trackEvent('council_started', {
        template_slug: selectedTemplate,
        question_length: trimmedQuestion.length,
        context_fields: [stakes, leaning, constraints].filter((value) => value.trim().length > 0).length,
      })

      const response = await fetch('/api/councils', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: buildQuestionWithContext(),
          template: selectedTemplate,
          context: {
            stakes: stakes.trim(),
            leaning: leaning.trim(),
            constraints: constraints.trim(),
          },
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to start council')
      }

      const councilId = payload?.id || payload?.council?.id

      if (!councilId) {
        throw new Error('Council created, but no council ID was returned')
      }

      router.push(`/dashboard/council/${councilId}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to run council'
      )
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-900 px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-purple-300">
            New Council
          </p>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Put a decision in front of your advisory board
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Choose a starting point, add the messy context, and let the council
            challenge the decision from multiple angles.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <section>
            <h2 className="mb-4 text-lg font-semibold text-white">
              Template Selection
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {templates.map((template) => {
                const isSelected = selectedTemplate === template.id

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(template.id)
                      trackEvent('template_selected', {
                        template_slug: template.id,
                        template_name: template.title,
                      })
                    }}
                    className={clsx(
                      'group relative rounded-lg border bg-slate-800/50 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl hover:shadow-purple-950/20',
                      isSelected
                        ? 'border-purple-500 ring-2 ring-purple-500/30'
                        : 'border-slate-700 hover:border-purple-500/60'
                    )}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-white">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                    <span className="mb-4 block text-3xl">{template.icon}</span>
                    <span className="block pr-5 font-semibold text-white transition-colors group-hover:text-purple-200">
                      {template.title}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-slate-400">
                      {template.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-lg border border-slate-700 bg-slate-800/40 p-5 sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Question Input
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedTemplate === 'custom-decision'
                    ? 'Describe the decision in your own words.'
                    : 'Coming soon — using general format for now.'}
                </p>
              </div>
              <span className="text-sm text-purple-300">
                {selectedTemplateMeta?.title}
              </span>
            </div>

            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={questionPlaceholder}
              rows={10}
              className="min-h-64 w-full resize-y rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-base leading-7 text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
            />

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  What&apos;s at stake?
                </span>
                <input
                  value={stakes}
                  onChange={(event) => setStakes(event.target.value)}
                  type="text"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
                  placeholder="Revenue, reputation, timing..."
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  What are you leaning toward?
                </span>
                <input
                  value={leaning}
                  onChange={(event) => setLeaning(event.target.value)}
                  type="text"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
                  placeholder="Approve, wait, renegotiate..."
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Key constraints?
                </span>
                <input
                  value={constraints}
                  onChange={(event) => setConstraints(event.target.value)}
                  type="text"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
                  placeholder="Budget, legal, deadline..."
                />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-700 bg-slate-800/40 p-5 sm:p-6">
            <p className="mb-4 text-center text-sm text-slate-400">
              You have{' '}
              <span className="font-semibold text-purple-300">
                {creditsRemaining ?? '...'}
              </span>{' '}
              credits remaining
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-6 py-4 font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              {isSubmitting ? 'Starting Council...' : 'Run Council'}
            </button>
          </section>
        </form>
      </div>
    </div>
  )
}
