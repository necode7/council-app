import posthog from 'posthog-js'

let initialized = false

export function initPostHog() {
  if (typeof window === 'undefined') {
    return false
  }

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) {
    return false
  }

  if (!initialized) {
    posthog.init(key, {
      api_host: 'https://us.i.posthog.com',
      capture_pageview: false,
      capture_pageleave: true,
      persistence: 'localStorage',
    })
    initialized = true
  }

  return true
}

export function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!initPostHog()) {
    return
  }

  posthog.capture(event, properties)
}
