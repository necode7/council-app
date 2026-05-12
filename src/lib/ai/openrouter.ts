// SERVER ONLY — never import from client components
import 'server-only'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const TIMEOUT_MS = 120_000
const MAX_RETRIES = 2
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

export const MODEL_CONFIG = {
  chairman: 'anthropic/claude-opus-4.7',
  advisors: [
    'openai/gpt-5.5',
    'google/gemini-3.1-pro-preview',
    'anthropic/claude-sonnet-4.6',
    'x-ai/grok-4.3',
    'deepseek/deepseek-v4-pro',
  ],
  clarifier: 'anthropic/claude-haiku-4.5',
  slugger: 'anthropic/claude-haiku-4.5',
} as const

export type AdvisorModel = (typeof MODEL_CONFIG.advisors)[number]

interface CallModelParams {
  model: string
  system: string
  user: string
  temperature?: number
  maxTokens?: number
  label: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function callModel({
  model,
  system,
  user,
  temperature = 0.7,
  maxTokens = 2048,
  label,
}: CallModelParams): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set')
  }

  let attempt = 0
  let currentMaxTokens = maxTokens

  while (attempt <= MAX_RETRIES) {
    const start = Date.now()

    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: currentMaxTokens,
    })

    let response: Response
    try {
      response = await fetchWithTimeout(
        `${OPENROUTER_BASE}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
            'X-Title': 'Council',
          },
          body,
        },
        TIMEOUT_MS
      )
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      if (isTimeout && attempt < MAX_RETRIES) {
        const backoff = 1000 * 2 ** attempt
        console.warn(`[${label}] timeout on attempt ${attempt + 1}, retrying in ${backoff}ms`)
        await sleep(backoff)
        attempt++
        continue
      }
      throw new Error(`[${label}] network error after ${attempt + 1} attempt(s): ${String(err)}`)
    }

    const elapsed = Date.now() - start

    if (!response.ok) {
      if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
        const retryAfter = response.headers.get('retry-after')
        const backoff = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : 1000 * 2 ** attempt
        console.warn(
          `[${label}] HTTP ${response.status} on attempt ${attempt + 1}, retrying in ${backoff}ms`
        )
        await sleep(backoff)
        attempt++
        continue
      }

      let errBody = ''
      try {
        errBody = await response.text()
      } catch {}
      throw new Error(
        `[${label}] OpenRouter error ${response.status} after ${attempt + 1} attempt(s): ${errBody}`
      )
    }

    let data: {
      choices?: Array<{ message?: { content?: string | null } }>
      error?: { message?: string }
    }
    try {
      data = await response.json()
    } catch {
      throw new Error(`[${label}] failed to parse JSON response`)
    }

    if (data.error?.message) {
      throw new Error(`[${label}] model error: ${data.error.message}`)
    }

    const content = data.choices?.[0]?.message?.content

    // Empty content — retry with more tokens
    if ((content === null || content === undefined || content === '') && attempt < MAX_RETRIES) {
      currentMaxTokens = Math.ceil(currentMaxTokens * 1.5)
      console.warn(
        `[${label}] empty content on attempt ${attempt + 1}, retrying with max_tokens=${currentMaxTokens}`
      )
      attempt++
      continue
    }

    if (!content) {
      throw new Error(`[${label}] received empty content after ${attempt + 1} attempt(s)`)
    }

    console.log(`[${label}] model=${model} attempt=${attempt + 1} elapsed=${elapsed}ms tokens=${currentMaxTokens}`)

    return content
  }

  // Unreachable but satisfies TypeScript
  throw new Error(`[${label}] exhausted all retries`)
}
