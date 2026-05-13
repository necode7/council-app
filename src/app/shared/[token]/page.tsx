import { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type JsonMap = Record<string, string>

interface Council {
  id: string
  title: string | null
  question: string
  status: string
  verdict: string | null
  advisor_responses: JsonMap | null
  reviews: JsonMap | null
  letter_map: JsonMap | null
  created_at: string
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
        className={`my-4 list-disc space-y-2 pl-5 ${prominent ? 'text-slate-100' : 'text-slate-300'}`}
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
        className={`my-4 leading-8 ${prominent ? 'text-lg text-slate-100' : 'text-slate-300'}`}
      >
        {renderInlineMarkdown(line)}
      </p>
    )
  })

  flushList()

  return <div>{blocks}</div>
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

export default async function SharedCouncilPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data: council, error } = await supabase
    .from('councils')
    .select(
      'id, title, question, status, verdict, advisor_responses, reviews, letter_map, created_at, share_token'
    )
    .eq('share_token', token)
    .single()

  if (error || !council) {
    notFound()
  }

  const record = council as Council
  const advisorResponses = normalizeMap(record.advisor_responses)
  const reviews = normalizeMap(record.reviews)
  const letterMap = normalizeMap(record.letter_map)

  return (
    <div className="min-h-screen bg-slate-900 px-5 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-purple-300">
            Shared Council Verdict
          </p>
          <h1 className="max-w-4xl text-3xl font-bold text-white sm:text-4xl">
            {record.title || 'Council deliberation'}
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
            <span>{formatDateTime(record.created_at)}</span>
            <span className="capitalize">Status: {record.status}</span>
          </div>
        </header>

        <section className="mb-10 rounded-lg border border-slate-700 bg-slate-800/40 p-6 sm:p-8">
          <h2 className="mb-3 text-lg font-semibold text-white">Question</h2>
          <p className="leading-8 text-slate-300">{record.question}</p>
        </section>

        <section className="mb-10 rounded-lg border border-purple-500/50 border-l-4 border-l-purple-400 bg-gradient-to-br from-purple-950/35 via-slate-800/80 to-slate-900 p-6 shadow-2xl shadow-purple-950/25 sm:p-8">
          <h2 className="mb-5 text-2xl font-bold text-white">Chairman&apos;s Verdict</h2>
          <MarkdownRenderer
            content={record.verdict || 'No verdict was recorded.'}
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
                Object.entries(advisorResponses).map(([name, response]) => (
                  <details
                    key={name}
                    className="rounded-lg border border-slate-700 bg-slate-800/40"
                  >
                    <summary className="cursor-pointer px-5 py-4 font-semibold text-white">
                      {name}
                    </summary>
                    <div className="border-t border-slate-700 px-5 py-5">
                      <MarkdownRenderer content={response} />
                    </div>
                  </details>
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
                Object.entries(reviews).map(([name, review]) => (
                  <details
                    key={name}
                    className="rounded-lg border border-slate-700 bg-slate-800/40"
                  >
                    <summary className="cursor-pointer px-5 py-4 font-semibold text-white">
                      Review by {name}
                    </summary>
                    <div className="border-t border-slate-700 px-5 py-5">
                      <MarkdownRenderer content={review} />
                    </div>
                  </details>
                ))
              ) : (
                <p className="rounded-lg border border-slate-700 bg-slate-800/40 p-5 text-slate-400">
                  No peer reviews recorded.
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="mt-12 rounded-lg border border-slate-700 bg-slate-800/40 p-6 text-center sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-purple-300">
            Powered by Council
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Get your own AI advisory board
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Run your own councils with five independent advisors, peer review, and
            a structured chairman verdict.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-purple-500"
          >
            Create your account
          </Link>
        </section>
      </div>
    </div>
  )
}
