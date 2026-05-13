'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { trackEvent } from '@/lib/analytics'

/**
 * PaymentButton Component
 *
 * Client-side component that initiates Cashfree payment checkout
 *
 * FLOW:
 * 1. User clicks "Upgrade to Pro" button
 * 2. Load Cashfree checkout script from CDN (dynamic import)
 * 3. Call /api/billing/checkout to create Cashfree order and get paymentSessionId
 * 4. Open Cashfree checkout modal using the paymentSessionId
 * 5. User completes payment in modal, redirected to return_url
 * 6. Cashfree sends webhook to /api/billing/webhook to confirm payment
 * 7. Webhook updates user's plan and credits in database
 *
 * PROPS:
 * - planId: 'pro' (identifies which plan to purchase)
 * - planName: 'Pro' (display name shown on button)
 * - onSuccess: Optional callback after payment completes
 *
 * STATE:
 * - loading: Prevents multiple clicks, shows "Processing..." during checkout
 *
 * ERRORS:
 * - Script load failures: Shows toast error
 * - API failures: Shows toast with error message
 * - Network issues: Handled by catch block
 */

interface PaymentButtonProps {
  planId: string
  planName: string
  onSuccess?: () => void
}

// Type definition for Cashfree SDK loaded from CDN
declare global {
  interface Window {
    Cashfree?: {
      checkout: (config: object) => void
    }
  }
}

export default function PaymentButton({
  planId,
  planName,
  onSuccess,
}: PaymentButtonProps) {
  // Track loading state during payment processing
  const [loading, setLoading] = useState(false)

  /**
   * Dynamically load Cashfree checkout script from CDN
   * Returns a Promise that resolves when script is loaded
   * Avoids loading script on every page load (only when user clicks)
   */
  const loadCashfreeScript = () => {
    return new Promise<void>((resolve, reject) => {
      // If script already loaded, resolve immediately
      if (window.Cashfree) {
        resolve()
        return
      }

      // Create script tag and add to document
      const script = document.createElement('script')
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
      script.async = true

      // On successful load, resolve promise
      script.onload = () => resolve()

      // On load failure, reject promise
      script.onerror = () => reject(new Error('Failed to load Cashfree script'))

      // Append to document to trigger download
      document.body.appendChild(script)
    })
  }

  /**
   * Handle click on "Upgrade to Pro" button
   * Main payment flow orchestration
   */
  const handlePayment = async () => {
    try {
      // Set loading state to disable button and show "Processing..."
      setLoading(true)

      trackEvent('plan_upgraded', {
        source: 'payment_button',
        plan_target: planId,
        action: 'checkout_started',
      })

      // STEP 1: Load Cashfree checkout script from CDN
      // This downloads the SDK that provides window.Cashfree.checkout()
      await loadCashfreeScript()

      // STEP 2: Call backend checkout API to create Cashfree order
      // Backend will:
      // - Verify user is authenticated
      // - Validate plan exists
      // - Call Cashfree API to create order
      // - Return paymentSessionId needed for modal
      const checkoutResponse = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }), // Send 'pro'
      })

      // Handle API errors
      if (!checkoutResponse.ok) {
        const error = await checkoutResponse.json()
        throw new Error(error.error || 'Checkout failed')
      }

      // Extract payment session ID from response
      const { paymentSessionId } = await checkoutResponse.json()

      // STEP 3: Open Cashfree checkout modal
      // User will see payment options (UPI, Cards, Wallets, etc.)
      // Modal is hosted by Cashfree (PCI DSS compliant)
      if (window.Cashfree) {
        window.Cashfree.checkout({
          paymentSessionId,
          // After payment, user is redirected here
          // Settings page can check ?payment=success query param
          returnUrl: `${window.location.origin}/dashboard/settings?payment=success`,
        })
      }

      // STEP 4: Execute success callback if provided
      // Delay 2s to allow payment modal to close first
      if (onSuccess) {
        setTimeout(() => onSuccess(), 2000)
      }
    } catch (error) {
      // Log error for debugging
      console.error('Payment error:', error)

      // Show user-friendly error message
      toast.error(
        error instanceof Error
          ? error.message
          : 'Payment failed. Please try again.'
      )
    } finally {
      // Clear loading state whether success or error
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
    >
      {loading ? 'Processing...' : `Upgrade to ${planName}`}
    </button>
  )
}
