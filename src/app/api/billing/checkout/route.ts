import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import 'server-only'

/**
 * POST /api/billing/checkout
 *
 * Creates a Cashfree payment order for subscription upgrade
 *
 * FLOW:
 * 1. Extract planId from request body (e.g., 'pro')
 * 2. Authenticate user via Supabase Auth (must be logged in)
 * 3. Validate plan exists and get pricing (Pro = ₹999/month = 99,900 paise)
 * 4. Call Cashfree API to create an order with order metadata
 * 5. Store order_id in user's profile for webhook verification later
 * 6. Return orderId and paymentSessionId to frontend for checkout modal
 *
 * SECURITY:
 * - Validates user authentication before creating order
 * - Uses server-only secrets (CASHFREE_CLIENT_ID, CASHFREE_CLIENT_SECRET)
 * - Stores order_id so webhook can verify payment belongs to correct user
 *
 * FRONTEND NEXT STEP: User receives paymentSessionId, opens Cashfree checkout modal
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request: expect { planId: 'pro' }
    const { planId } = await request.json()

    // Get authenticated user from Supabase session
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Reject if not authenticated
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Define available subscription plans with pricing
    // Amount is stored in paise (100 paise = 1 rupee)
    const PLANS: Record<string, { name: string; amount: number }> = {
      pro: { name: 'Pro', amount: 99900 }, // ₹999/month
    }

    // Validate that requested plan exists
    if (!PLANS[planId]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const plan = PLANS[planId]

    // Build Cashfree order payload
    // This order will be sent to Cashfree API to create a payment session
    const orderPayload = {
      // Unique order ID: format is order_{userId}_{timestamp}
      // This ensures no duplicate orders and easy user identification
      order_id: `order_${user.id}_${Date.now()}`,

      // Amount in rupees (Cashfree API expects rupees, not paise)
      order_amount: plan.amount / 100,

      // Currency code for India
      order_currency: 'INR',

      // Customer details: populate with authenticated user info
      customer_details: {
        customer_id: user.id, // Link order to our user
        customer_email: user.email, // For payment receipts
        customer_phone: '', // Optional: can be collected from user later
      },

      // Metadata: URLs for post-payment navigation and webhook callback
      order_meta: {
        // User returns here after completing payment
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?payment=success`,

        // Cashfree sends webhook notification to this URL
        notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/billing/webhook`,
      },

      // Human-readable order description
      order_note: `${plan.name} Plan Subscription`,
    }

    // Call Cashfree API to create order
    // This returns a paymentSessionId that opens the checkout modal
    const response = await fetch('https://api.cashfree.com/pg/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01', // Latest Cashfree API version
        'x-client-id': process.env.CASHFREE_CLIENT_ID!, // From .env.local
        'x-client-secret': process.env.CASHFREE_CLIENT_SECRET!, // From .env.local
      },
      body: JSON.stringify(orderPayload),
    })

    // Handle API errors
    if (!response.ok) {
      const error = await response.json()
      console.error('Cashfree API error:', error)
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: response.status }
      )
    }

    const orderData = await response.json()

    // Store order details in user's profile
    // This allows the webhook (step 3) to verify the payment matches the user
    // and know which plan they're upgrading to
    await supabase
      .from('profiles')
      .update({
        cashfree_order_id: orderData.order_id, // Store for webhook verification
        subscription_plan: planId, // Store which plan user is purchasing
      })
      .eq('id', user.id)

    // Return payment details to frontend
    // Frontend will use paymentSessionId to open Cashfree checkout modal
    return NextResponse.json({
      orderId: orderData.order_id,
      paymentSessionId: orderData.payment_session_id,
    })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
