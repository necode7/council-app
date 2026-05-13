/**
 * API Route: /api/councils/[id]/outcome
 *
 * POST — Record or update the outcome of a completed council decision
 */

import { createClient } from '@/lib/supabase/server'
import { sanitizeInput } from '@/lib/sanitize'
import { AuthError, AppError, ValidationError, errorResponse } from '@/lib/errors'

type OutcomeValue = 'positive' | 'negative' | 'mixed' | 'pending'

const VALID_OUTCOMES: OutcomeValue[] = ['positive', 'negative', 'mixed', 'pending']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // --- Authenticate ---
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new AuthError()

    // --- Verify the council exists and belongs to this user ---
    const { data: council, error: councilError } = await supabase
      .from('councils')
      .select('id, user_id, status')
      .eq('id', id)
      .single()

    if (councilError || !council) {
      throw new AppError('Council not found', 'NOT_FOUND', 404)
    }

    if (council.user_id !== user.id) {
      throw new AppError('Not authorized', 'FORBIDDEN', 403)
    }

    if (council.status !== 'complete') {
      throw new ValidationError('Council is not complete — cannot record outcome yet')
    }

    // --- Parse body ---
    const body = await request.json()
    const { outcome, details } = body as {
      outcome?: string
      details?: string
    }

    if (!outcome || !VALID_OUTCOMES.includes(outcome as OutcomeValue)) {
      throw new ValidationError(`Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(', ')}`)
    }

    const sanitizedDetails = details ? sanitizeInput(details) : null

    // --- Check if an outcome already exists ---
    const { data: existing } = await supabase
      .from('decision_outcomes')
      .select('id')
      .eq('council_id', id)
      .single()

    if (existing) {
      const { error: updateError } = await supabase
        .from('decision_outcomes')
        .update({
          outcome,
          outcome_details: sanitizedDetails || null,
          recorded_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        throw new AppError('Failed to update outcome', 'DB_ERROR', 500)
      }

      return Response.json({ status: 'updated', outcome })
    }

    // --- Insert new outcome ---
    const { error: insertError } = await supabase
      .from('decision_outcomes')
      .insert({
        council_id: id,
        outcome,
        outcome_details: sanitizedDetails || null,
        recorded_at: new Date().toISOString(),
      })

    if (insertError) {
      throw new AppError('Failed to save outcome', 'DB_ERROR', 500)
    }

    return Response.json({ status: 'created', outcome })
  } catch (error) {
    return errorResponse(error)
  }
}
