import { createClient } from '@/lib/supabase/server'

const ADVISOR_MODELS = [
  'openai/gpt-5.5',
  'google/gemini-3.1-pro-preview',
  'anthropic/claude-sonnet-4.6',
  'x-ai/grok-4.3',
  'deepseek/deepseek-v4-pro',
]

type ValueMap = Record<string, string>

interface CouncilRow {
  id: string
  user_id: string
  title: string | null
  question: string
  context: unknown
  status: string
  template_id: string | null
  advisor_responses: unknown
  reviews: unknown
  letter_map: unknown
  verdict: string | null
  model_config: unknown
  created_at: string
  completed_at: string | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json(
        { error: 'Not authenticated', code: 'AUTH_REQUIRED' },
        { status: 401 },
      )
    }

    const { data, error: fetchError } = await supabase
      .from('councils')
      .select(
        'id, user_id, title, question, context, status, template_id, advisor_responses, reviews, letter_map, verdict, model_config, created_at, completed_at',
      )
      .eq('id', id)
      .single()

    if (fetchError || !data) {
      return Response.json(
        { error: 'Council not found', code: 'NOT_FOUND' },
        { status: 404 },
      )
    }

    const council = data as CouncilRow

    if (council.user_id !== user.id) {
      return Response.json(
        { error: 'Not authorized', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }

    if (council.status !== 'complete') {
      return Response.json(
        { error: 'Council is not complete', code: 'NOT_READY' },
        { status: 400 },
      )
    }

    let templateName = 'Custom Decision'
    if (council.template_id) {
      const { data: template } = await supabase
        .from('templates')
        .select('name')
        .eq('id', council.template_id)
        .maybeSingle()

      if (template?.name) {
        templateName = template.name
      }
    }

    const title = resolveTitle(council.title, council.question)
    const createdAt = new Date(council.created_at)
    const completedAt = council.completed_at ? new Date(council.completed_at) : new Date()
    const generatedAt = new Date()
    const mode = council.template_id ? 'Template-Guided Council' : 'Custom Council'
    const elapsed = formatElapsed(createdAt, completedAt)

    const contextValues = normalizeValueMap(council.context)
    const advisorResponses = normalizeValueMap(council.advisor_responses)
    const reviews = normalizeValueMap(council.reviews)
    const letterMap = normalizeValueMap(council.letter_map)
    const modelLabels = resolveAdvisorModels(council.model_config)

    const questionContextItems = Object.entries(contextValues)
      .map(
        ([key, value]) => `
          <div class="context-item">
            <div class="context-key">${escapeHtml(formatKey(key))}</div>
            <div class="context-value">${escapeHtml(value)}</div>
          </div>`,
      )
      .join('\n')

    const advisorCards = Object.entries(advisorResponses)
      .map(([name, response], index) => {
        const model = modelLabels[index] ?? ADVISOR_MODELS[index] ?? 'Advisor model'
        return `
          <article class="card">
            <div class="card-head">
              <h3>${escapeHtml(name)}</h3>
              <p class="sub">${escapeHtml(model)}</p>
            </div>
            <div class="card-body md">${markdownToHtml(response)}</div>
          </article>`
      })
      .join('\n')

    const peerReviewCards = Object.entries(reviews)
      .map(
        ([name, review]) => `
          <article class="card">
            <div class="card-head">
              <h3>Review by ${escapeHtml(name)}</h3>
            </div>
            <div class="card-body md">${markdownToHtml(review)}</div>
          </article>`,
      )
      .join('\n')

    const anonymizationMap = Object.entries(letterMap)
      .map(([letter, advisor]) => `${escapeHtml(letter)} = ${escapeHtml(advisor)}`)
      .join(' | ')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} - Council Report</title>
  <style>
    @page { size: A4; margin: 2cm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #111827; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.6;
    }
    h1, h2, h3, h4 {
      margin: 0;
      font-family: Helvetica, Arial, sans-serif;
      letter-spacing: 0;
    }
    p { margin: 0; }
    .page-break { page-break-after: always; }

    .cover {
      min-height: calc(297mm - 4cm);
      display: flex;
      flex-direction: column;
      justify-content: center;
      border-top: 6px solid #7c3aed;
      padding-top: 24px;
    }
    .eyebrow {
      font-family: Helvetica, Arial, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 9pt;
      color: #7c3aed;
      margin-bottom: 10px;
      font-weight: 700;
    }
    .cover h1 {
      font-size: 30pt;
      line-height: 1.2;
      margin-bottom: 14px;
      color: #111827;
    }
    .cover-subtitle {
      color: #4b5563;
      font-size: 12pt;
      margin-bottom: 32px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-top: 10px;
    }
    .meta-card {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 12px 14px;
      background: #fafafa;
    }
    .meta-label {
      font-family: Helvetica, Arial, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 8pt;
      color: #6b7280;
      margin-bottom: 6px;
      font-weight: 700;
    }
    .meta-value {
      font-size: 11pt;
      color: #111827;
      font-weight: 600;
    }

    .toc h2,
    section h2 {
      color: #7c3aed;
      font-size: 17pt;
      margin-bottom: 14px;
      border-bottom: 2px solid #ede9fe;
      padding-bottom: 8px;
    }
    .toc ol {
      margin: 0;
      padding-left: 20px;
    }
    .toc li {
      margin: 8px 0;
      color: #1f2937;
    }

    section { margin-bottom: 30px; }

    .quote-box {
      border-left: 6px solid #7c3aed;
      background: #f5f3ff;
      border-radius: 8px;
      padding: 18px 18px 16px;
    }
    .quote-label {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 8.5pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6d28d9;
      margin-bottom: 8px;
      font-weight: 700;
    }
    .question-text {
      font-size: 11.5pt;
      color: #111827;
      margin-bottom: 14px;
    }
    .context-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 6px;
    }
    .context-item {
      border: 1px solid #ddd6fe;
      background: #ffffff;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .context-key {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6d28d9;
      margin-bottom: 4px;
      font-weight: 700;
    }
    .context-value {
      color: #111827;
      font-size: 10.5pt;
      white-space: pre-wrap;
    }

    .verdict {
      border-left: 6px solid #7c3aed;
      padding: 16px 18px;
      background: linear-gradient(180deg, #faf5ff 0%, #ffffff 100%);
      border-radius: 8px;
    }

    .card {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      margin-bottom: 14px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .card-head {
      padding: 12px 14px;
      background: #fafafa;
      border-bottom: 1px solid #e5e7eb;
    }
    .card-head h3 {
      font-size: 12pt;
      color: #111827;
      margin-bottom: 2px;
    }
    .sub {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 9pt;
      color: #6b7280;
    }
    .card-body {
      padding: 14px;
      color: #111827;
    }
    .meta-line {
      margin: 4px 0 14px;
      font-family: Helvetica, Arial, sans-serif;
      color: #6b7280;
      font-size: 9pt;
    }

    .md h1, .md h2, .md h3 {
      margin: 16px 0 8px;
      color: #111827;
      font-family: Helvetica, Arial, sans-serif;
    }
    .md h1 { font-size: 15pt; }
    .md h2 { font-size: 13.5pt; }
    .md h3 { font-size: 12pt; }
    .md p { margin: 8px 0; }
    .md ul {
      margin: 8px 0 8px 18px;
      padding: 0;
    }
    .md li { margin: 5px 0; }
    .md strong { font-weight: 700; }
    .md em { font-style: italic; }

    .footer {
      margin-top: 36px;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
      text-align: center;
      font-family: Helvetica, Arial, sans-serif;
      color: #6b7280;
      font-size: 8.5pt;
    }
  </style>
</head>
<body>
  <section class="cover page-break">
    <div class="eyebrow">Council Advisory Report</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="cover-subtitle">Professional multi-advisor decision brief</p>
    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-label">Date</div>
        <div class="meta-value">${formatDate(createdAt)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Mode</div>
        <div class="meta-value">${escapeHtml(mode)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Template</div>
        <div class="meta-value">${escapeHtml(templateName)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Time Elapsed</div>
        <div class="meta-value">${escapeHtml(elapsed)}</div>
      </div>
    </div>
  </section>

  <section class="toc page-break">
    <h2>Table of Contents</h2>
    <ol>
      <li>Cover</li>
      <li>Table of Contents</li>
      <li>Question &amp; Context</li>
      <li>Chairman's Verdict</li>
      <li>Advisor Responses</li>
      <li>Peer Reviews</li>
    </ol>
  </section>

  <section>
    <h2>Question &amp; Context</h2>
    <div class="quote-box">
      <div class="quote-label">Decision Prompt</div>
      <p class="question-text">${escapeHtml(council.question)}</p>
      ${
        questionContextItems
          ? `<div class="quote-label">Context</div>
             <div class="context-grid">${questionContextItems}</div>`
          : '<p class="meta-line">No additional context was provided.</p>'
      }
    </div>
  </section>

  <section>
    <h2>Chairman's Verdict</h2>
    <div class="verdict md">
      ${markdownToHtml(council.verdict || 'No verdict available.')}
    </div>
  </section>

  <section>
    <h2>Advisor Responses</h2>
    ${
      advisorCards ||
      '<p class="meta-line">No advisor responses were recorded for this council.</p>'
    }
  </section>

  <section>
    <h2>Peer Reviews</h2>
    ${
      anonymizationMap
        ? `<p class="meta-line"><strong>Anonymization map:</strong> ${anonymizationMap}</p>`
        : '<p class="meta-line">No anonymization map recorded.</p>'
    }
    ${
      peerReviewCards ||
      '<p class="meta-line">No peer reviews were recorded for this council.</p>'
    }
  </section>

  <footer class="footer">
    Generated by Council on ${formatDateTime(generatedAt)}
  </footer>
</body>
</html>`

    const filename = `Council_${escapeFilename(title)}_${generatedAt.toISOString().slice(0, 10)}.html`

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return Response.json(
      { error: message, code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}

function resolveTitle(slugOrTitle: string | null, question: string): string {
  if (slugOrTitle && slugOrTitle.trim().length > 0) {
    return slugOrTitle
      .split('_')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const trimmed = question.trim()
  if (!trimmed) {
    return 'Council Advisory Report'
  }

  return trimmed.length > 90 ? `${trimmed.slice(0, 87)}...` : trimmed
}

function normalizeValueMap(value: unknown): ValueMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.entries(value as Record<string, unknown>).reduce<ValueMap>(
    (acc, [key, raw]) => {
      if (raw === null || raw === undefined) {
        return acc
      }

      if (typeof raw === 'string') {
        acc[key] = raw
        return acc
      }

      if (typeof raw === 'number' || typeof raw === 'boolean') {
        acc[key] = String(raw)
        return acc
      }

      acc[key] = JSON.stringify(raw)
      return acc
    },
    {},
  )
}

function resolveAdvisorModels(modelConfig: unknown): string[] {
  if (!modelConfig || typeof modelConfig !== 'object' || Array.isArray(modelConfig)) {
    return []
  }

  const maybeList = (modelConfig as { advisors?: unknown }).advisors
  if (!Array.isArray(maybeList)) {
    return []
  }

  return maybeList
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r/g, '').split('\n')
  const blocks: string[] = []
  let listItems: string[] = []

  const flushList = () => {
    if (listItems.length === 0) {
      return
    }

    blocks.push(`<ul>${listItems.join('')}</ul>`)
    listItems = []
  }

  for (const raw of lines) {
    const line = raw.trim()

    if (!line) {
      flushList()
      continue
    }

    const listMatch = line.match(/^[-*]\s+(.+)$/)
    if (listMatch) {
      listItems.push(`<li>${formatInline(listMatch[1])}</li>`)
      continue
    }

    flushList()

    if (line.startsWith('### ')) {
      blocks.push(`<h3>${formatInline(line.slice(4))}</h3>`)
      continue
    }

    if (line.startsWith('## ')) {
      blocks.push(`<h2>${formatInline(line.slice(3))}</h2>`)
      continue
    }

    if (line.startsWith('# ')) {
      blocks.push(`<h1>${formatInline(line.slice(2))}</h1>`)
      continue
    }

    blocks.push(`<p>${formatInline(line)}</p>`)
  }

  flushList()
  return blocks.join('\n')
}

function formatInline(text: string): string {
  const escaped = escapeHtml(text)
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function formatKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(value)
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

function formatElapsed(start: Date, end: Date): string {
  const totalSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80)
}
