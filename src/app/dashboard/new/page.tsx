'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Check, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/analytics'

type FieldType = 'text' | 'textarea' | 'select'

interface IntakeField {
  key: string
  label: string
  type: FieldType
  options?: string[]
}

interface Template {
  id: string
  slug: string
  name: string
  description: string
  intake_schema: unknown
}

const questionPlaceholder = `Council this:
Should we move forward with...

Context:
The situation is...

The real question:
What should we do, and what are we missing?`

function normalizeIntakeSchema(schema: unknown): IntakeField[] {
  if (!Array.isArray(schema)) {
    return []
  }

  return schema.reduce<IntakeField[]>((acc, field) => {
    if (!field || typeof field !== 'object') {
      return acc
    }

    const raw = field as Record<string, unknown>
    const key = typeof raw.key === 'string' ? raw.key.trim() : ''
    const label = typeof raw.label === 'string' ? raw.label.trim() : ''
    const rawType = typeof raw.type === 'string' ? raw.type.trim() : 'text'

    if (!key || !label) {
      return acc
    }

    const type: FieldType =
      rawType === 'textarea' || rawType === 'select' ? rawType : 'text'
    const options =
      type === 'select' && Array.isArray(raw.options)
        ? raw.options.filter((option): option is string => typeof option === 'string')
        : undefined

    acc.push({
      key,
      label,
      type,
      options,
    })
    return acc
  }, [])
}

export default function NewCouncilPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [selectedTemplateSlug, setSelectedTemplateSlug] = useState<string | null>(
    null
  )
  const [question, setQuestion] = useState('')
  const [intakeValues, setIntakeValues] = useState<Record<string, string>>({})
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        const [creditsResult, templatesResult] = await Promise.all([
          user
            ? supabase
                .from('profiles')
                .select('credits_remaining')
                .eq('id', user.id)
                .single()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from('templates')
            .select('id, slug, name, description, intake_schema, is_public')
            .eq('is_public', true)
            .order('created_at', { ascending: true }),
        ])

        if (!creditsResult.error && creditsResult.data) {
          setCreditsRemaining(creditsResult.data.credits_remaining ?? 0)
        }

        if (templatesResult.error) {
          throw templatesResult.error
        }

        setTemplates((templatesResult.data || []) as Template[])
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to load templates'
        )
      } finally {
        setTemplatesLoading(false)
      }
    }

    void loadData()
  }, [supabase])

  const selectedTemplate = useMemo(
    () =>
      selectedTemplateSlug
        ? templates.find((template) => template.slug === selectedTemplateSlug) || null
        : null,
    [templates, selectedTemplateSlug]
  )

  const intakeFields = useMemo(
    () => normalizeIntakeSchema(selectedTemplate?.intake_schema),
    [selectedTemplate?.intake_schema]
  )

  const handleTemplateSelection = (template: Template | null) => {
    if (!template) {
      setSelectedTemplateSlug(null)
      setIntakeValues({})
      trackEvent('template_selected', {
        template_slug: 'custom-decision',
        template_name: 'Custom Decision',
      })
      return
    }

    setSelectedTemplateSlug(template.slug)
    const fields = normalizeIntakeSchema(template.intake_schema)
    const nextValues = fields.reduce<Record<string, string>>((acc, field) => {
      acc[field.key] = ''
      return acc
    }, {})
    setIntakeValues(nextValues)
    trackEvent('template_selected', {
      template_slug: template.slug,
      template_name: template.name,
    })
  }

  const trimmedQuestion = question.trim()
  const canSubmit = trimmedQuestion.length > 0 && !isSubmitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!trimmedQuestion) {
      return
    }

    setIsSubmitting(true)

    try {
      const context = Object.entries(intakeValues).reduce<Record<string, string>>(
        (acc, [key, value]) => {
          const trimmedValue = value.trim()
          if (trimmedValue) {
            acc[key] = trimmedValue
          }
          return acc
        },
        {}
      )

      trackEvent('council_started', {
        template_slug: selectedTemplateSlug || 'custom-decision',
        question_length: trimmedQuestion.length,
        context_fields: Object.keys(context).length,
      })

      const response = await fetch('/api/councils', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          template_slug: selectedTemplateSlug || undefined,
          context,
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

            {templatesLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3 text-slate-300">
                <Loader2 size={16} className="animate-spin" />
                Loading templates...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {templates.map((template) => {
                  const isSelected = selectedTemplateSlug === template.slug

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleTemplateSelection(template)}
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
                      <span className="mb-4 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        Template
                      </span>
                      <span className="block pr-5 font-semibold text-white transition-colors group-hover:text-purple-200">
                        {template.name}
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-slate-400">
                        {template.description}
                      </span>
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={() => handleTemplateSelection(null)}
                  className={clsx(
                    'group relative rounded-lg border bg-slate-800/50 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl hover:shadow-purple-950/20',
                    selectedTemplateSlug === null
                      ? 'border-purple-500 ring-2 ring-purple-500/30'
                      : 'border-slate-700 hover:border-purple-500/60'
                  )}
                  aria-pressed={selectedTemplateSlug === null}
                >
                  {selectedTemplateSlug === null && (
                    <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-white">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                  <span className="mb-4 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    Custom
                  </span>
                  <span className="block pr-5 font-semibold text-white transition-colors group-hover:text-purple-200">
                    Custom Decision
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-slate-400">
                    Start free-form with your own context and question.
                  </span>
                </button>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-700 bg-slate-800/40 p-5 sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Question Input
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Describe the decision and what outcome you need clarity on.
                </p>
              </div>
              <span className="text-sm text-purple-300">
                {selectedTemplate?.name || 'Custom Decision'}
              </span>
            </div>

            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={questionPlaceholder}
              rows={10}
              className="min-h-64 w-full resize-y rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-base leading-7 text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
            />

            {selectedTemplate && (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-300">
                  Template Intake
                </h3>

                {intakeFields.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    This template has no extra intake fields.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {intakeFields.map((field) => {
                      if (field.type === 'textarea') {
                        return (
                          <label key={field.key} className="block lg:col-span-2">
                            <span className="mb-2 block text-sm font-medium text-slate-300">
                              {field.label}
                            </span>
                            <textarea
                              value={intakeValues[field.key] || ''}
                              onChange={(event) =>
                                setIntakeValues((current) => ({
                                  ...current,
                                  [field.key]: event.target.value,
                                }))
                              }
                              rows={3}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
                            />
                          </label>
                        )
                      }

                      if (field.type === 'select') {
                        return (
                          <label key={field.key} className="block">
                            <span className="mb-2 block text-sm font-medium text-slate-300">
                              {field.label}
                            </span>
                            <select
                              value={intakeValues[field.key] || ''}
                              onChange={(event) =>
                                setIntakeValues((current) => ({
                                  ...current,
                                  [field.key]: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition-colors focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
                            >
                              <option value="">Select...</option>
                              {(field.options || []).map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                        )
                      }

                      return (
                        <label key={field.key} className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-300">
                            {field.label}
                          </span>
                          <input
                            value={intakeValues[field.key] || ''}
                            onChange={(event) =>
                              setIntakeValues((current) => ({
                                ...current,
                                [field.key]: event.target.value,
                              }))
                            }
                            type="text"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
                          />
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
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
