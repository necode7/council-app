import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import 'server-only'

/**
 * POST /api/billing/webhook
 *
 * Receives and processes payment notifications from Cashfree
 *
 * FLOW:
 * 1. Extract webhook signature from headers and request body
 * 2. Verify signature using CASHFREE_WEBHOOK_SECRET (prevents spoofing)
 * 3. Parse event type and payment status
 * 4. On PAYMENT_SUCCESS: Upgrade user to pro plan with 30 credits
 * 5. On PAYMENT_FAILED: Log failure (user remains on free plan)
 * 6. On SUBSCRIPTION_CANCELLED: Downgrade user to free plan with 5 credits
 * 7. Always return 200 OK (Cashfree will retry on non-200 responses)
 *
 * SECURITY:
 * - Verifies webhook signature to ensure request is from Cashfree, not attacker
 * - Uses HMAC-SHA256 with CASHFREE_WEBHOOK_SECRET from environment
 * - Uses order_id stored in checkout to identify correct user
 * - Returns 200 OK on all events to prevent Cashfree retry storms
 *
 * IMPORTANT: Configure webhook URL in Cashfree Dashboard:
 * https://dashboard.cashfree.com → Webhooks → Add: {NEXT_PUBLIC_APP_URL}/api/billing/webhook
 */
export async function POST(request: NextRequest) {
  try {
    // Read raw body as text (needed for signature verification)
    const body = await request.text()

    // Extract signature from Cashfree webhook headers
    // Cashfree sends: x-webhook-signature = HMAC-SHA256(body, webhook_secret)
    const signature = request.headers.get('x-webhook-signature')

    // If no signature present, silently acknowledge (Cashfree will retry)
    if (!signature) {
      console.warn('Missing webhook signature')
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // VERIFY WEBHOOK AUTHENTICITY
    // This prevents attackers from pretending to be Cashfree and upgrading users
    const computedSignature = crypto
      .createHmac('sha256', process.env.CASHFREE_WEBHOOK_SECRET!)
      .update(body)
      .digest('base64')

    // If signature doesn't match, reject the webhook
    if (signature !== computedSignature) {
      console.warn('Invalid webhook signature')
      // Return 403 to signal invalid request, but still return OK to Cashfree
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // Parse webhook event
    const event = JSON.parse(body)

    // CASE 1: PAYMENT_SUCCESS
    // Triggered when user completes payment and Cashfree confirms it
    // Action: Upgrade user's subscription, grant credits
    if (event.type === 'PAYMENT_SUCCESS') {
      const { order_id } = event.data

      const supabase = await createClient()

      // Find user by order_id (we stored this in checkout route)
      // This ensures we upgrade the correct user who initiated the payment
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('cashfree_order_id', order_id)
        .single()

      // If user found, update their subscription
      if (profile) {
        await supabase
          .from('profiles')
          .update({
            plan: 'pro', // Upgrade plan from 'free' to 'pro'
            credits_remaining: 30, // Grant 30 monthly credits
            subscription_active: true, // Mark subscription as active
            cashfree_order_id: null, // Clear order_id after successful payment
          })
          .eq('id', profile.id)

        console.log(`✓ User ${profile.id} upgraded to Pro plan`)
      }

      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // CASE 2: PAYMENT_FAILED
    // Triggered when payment fails (user declined, card declined, etc.)
    // Action: Log failure, user remains on free plan (no downgrade needed)
    if (event.type === 'PAYMENT_FAILED') {
      const { order_id } = event.data
      console.warn(`✗ Payment failed for order ${order_id}`)
      // User remains on free plan, no database update needed
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // CASE 3: SUBSCRIPTION_CANCELLED
    // Triggered when user cancels their subscription manually
    // Action: Downgrade user to free plan, reduce credits
    if (event.type === 'SUBSCRIPTION_CANCELLED') {
      const supabase = await createClient()

      // Find user by subscription_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('cashfree_order_id', event.data.subscription_id)
        .single()

      // If user found, downgrade their subscription
      if (profile) {
        await supabase
          .from('profiles')
          .update({
            plan: 'free', // Downgrade from 'pro' to 'free'
            credits_remaining: 5, // Reset to free tier credits
            subscription_active: false, // Mark subscription as inactive
          })
          .eq('id', profile.id)

        console.log(`↓ User ${profile.id} downgraded to Free plan`)
      }

      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // CASE 4: Unknown event types
    // Acknowledge without processing (in case Cashfree adds new event types)
    console.log(`Received unknown webhook event: ${event.type}`)
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (error) {
    console.error('Webhook processing error:', error)
    // Always return 200 OK to Cashfree
    // Returning 5xx would cause Cashfree to retry the webhook multiple times
    // Better to log the error and investigate manually
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  }
}
