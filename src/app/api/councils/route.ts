/**
 * API Route: /api/councils
 *
 * POST — Create and run a new council deliberation
 * GET  — List the user's past councils
 */

import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runCouncil } from '@/lib/council/pipeline'
import { checkCredits, deductCredit, resetCreditsIfNeeded } from '@/lib/credits'
import { sendEmail } from '@/lib/email/send'
import { checkRateLimit } from '@/lib/rateLimit'
import { sanitizeInput } from '@/lib/sanitize'
import { AuthError, ValidationError, CreditError, AIError, errorResponse } from '@/lib/errors'

// ============================================================
// POST /api/councils — Create & Run a Council
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // --- Authenticate ---
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new AuthError()

    // --- Rate limit ---
    const rateLimit = checkRateLimit(user.id)
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Too many requests', code: 'RATE_LIMITED' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        },
      )
    }

    // --- Reset credits if monthly period has rolled over ---
    await resetCreditsIfNeeded(user.id)

    // --- Check credits ---
    const credits = await checkCredits(user.id)
    if (!credits.hasCredits) throw new CreditError()

    // --- Parse body ---
    const body = await request.json()
    const { question, template_slug, context } = body as {
      question?: string
      template_slug?: string
      context?: Record<string, unknown>
    }

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      throw new ValidationError('Question is required')
    }

    const sanitizedQuestion = sanitizeInput(question)

    // --- Resolve template ---
    let template = null
    if (template_slug) {
      const slug = sanitizeInput(template_slug)
      const { data: tmpl } = await supabase
        .from('templates')
        .select('*')
        .eq('slug', slug)
        .single()

      if (tmpl) {
        template = {
          advisor_panel: tmpl.advisor_panel,
          chairman_prompt: tmpl.chairman_prompt,
        }
      }
    }

    // --- Create council row (status = 'running') ---
    const { data: council, error: insertError } = await supabase
      .from('councils')
      .insert({
        user_id: user.id,
        template_id: template_slug ? undefined : null,
        question: sanitizedQuestion,
        context: context || {},
        status: 'running',
      })
      .select('id')
      .single()

    if (insertError || !council) {
      throw new AIError('Failed to create council')
    }

    const councilId = council.id

    // --- Update status as pipeline progresses ---
    const updateStatus = async (status: string) => {
      await supabase
        .from('councils')
        .update({ status })
        .eq('id', councilId)
    }

    // --- Run the pipeline ---
    try {
      const result = await runCouncil(sanitizedQuestion, template, async (stage) => {
        const statusMap: Record<string, string> = {
          slug: 'running',
          advisors: 'advisors',
          review: 'review',
          chairman: 'chairman',
          complete: 'complete',
          error: 'failed',
        }
        const dbStatus = statusMap[stage] || 'running'
        await updateStatus(dbStatus)
      })

      // --- Save results ---
      await supabase
        .from('councils')
        .update({
          title: result.slug,
          advisor_responses: result.advisorResponses,
          letter_map: result.letterMap,
          reviews: result.reviews,
          verdict: result.verdict,
          status: 'complete',
          completed_at: new Date().toISOString(),
        })
        .eq('id', councilId)

      // --- Deduct 1 credit (atomic — cannot go negative) ---
      await deductCredit(user.id)

      // --- Notify user that their verdict is ready ---
      if (user.email) {
        sendEmail({
          to: user.email,
          template: 'council-complete',
          data: { question: sanitizedQuestion, councilId },
        }).catch(() => {})
      }

      return Response.json({ id: councilId, status: 'complete' })
    } catch (pipelineError) {
      await updateStatus('failed')
      throw new AIError(
        pipelineError instanceof Error ? pipelineError.message : 'Pipeline failed',
      )
    }
  } catch (error) {
    return errorResponse(error)
  }
}

// ============================================================
// GET /api/councils — List User's Councils
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // --- Authenticate ---
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new AuthError()

    // --- Parse query params ---
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10)
    const clampedLimit = Math.min(Math.max(limit, 1), 100)

    // --- Fetch councils ---
    const { data: councils, error: fetchError } = await supabase
      .from('councils')
      .select('id, title, question, status, template_id, created_at, completed_at, verdict')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(clampedLimit)

    if (fetchError) {
      throw new AIError('Failed to fetch councils')
    }

    return Response.json({ councils: councils || [] })
  } catch (error) {
    return errorResponse(error)
  }
}
