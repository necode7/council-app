'use client'

import { Toaster } from 'react-hot-toast'

export function Providers() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#0f0c20',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          color: '#e9e7f2',
        },
      }}
    />
  )
}
