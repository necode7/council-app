'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { initPostHog, trackEvent } from '@/lib/analytics'

export default function PostHogProvider({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()
  const lastTrackedUrl = useRef<string | null>(null)

  useEffect(() => {
    initPostHog()
  }, [])

  useEffect(() => {
    if (!pathname || typeof window === 'undefined') {
      return
    }

    const url = window.location.href
    if (lastTrackedUrl.current === url) {
      return
    }

    lastTrackedUrl.current = url
    trackEvent('page_view', {
      path: pathname,
      url,
    })
  }, [pathname])

  return <>{children}</>
}
