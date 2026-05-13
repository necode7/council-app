const REQUIRED_SERVER_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'OPENROUTER_API_KEY',
  'NEXT_PUBLIC_APP_URL',
] as const

const OPTIONAL_SERVER_VARS = [
  'RESEND_API_KEY',
  'INTERNAL_API_KEY',
  'CRON_SECRET',
  'CASHFREE_CLIENT_ID',
  'CASHFREE_CLIENT_SECRET',
  'CASHFREE_WEBHOOK_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

export function validateEnv(): void {
  const missing: string[] = []

  for (const key of REQUIRED_SERVER_VARS) {
    if (!process.env[key] || process.env[key]!.trim().length === 0) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  ${missing.join('\n  ')}\n\nCheck your .env.local file.`,
    )
  }

  const configured: string[] = []
  const unconfigured: string[] = []

  for (const key of OPTIONAL_SERVER_VARS) {
    if (process.env[key] && process.env[key]!.trim().length > 0) {
      configured.push(key)
    } else {
      unconfigured.push(key)
    }
  }

  if (unconfigured.length > 0) {
    console.warn(`[env] Optional vars not set (features disabled): ${unconfigured.join(', ')}`)
  }
}
