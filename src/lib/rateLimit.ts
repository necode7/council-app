import 'server-only'

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_REQUESTS = 10

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number | null
}

export function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now()
  const entry = store.get(userId) ?? { timestamps: [] }

  // Evict timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS)

  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldest = entry.timestamps[0]
    const retryAfterSeconds = Math.ceil((oldest + WINDOW_MS - now) / 1000)
    store.set(userId, entry)
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  entry.timestamps.push(now)
  store.set(userId, entry)
  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.timestamps.length,
    retryAfterSeconds: null,
  }
}
