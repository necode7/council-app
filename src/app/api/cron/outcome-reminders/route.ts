/**
 * API Route: /api/cron/outcome-reminders
 *
 * GET — Returns councils completed 30+ days ago that have no outcome recorded.
 *       Protected by CRON_SECRET env var. Email integration comes later.
 */

import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    // --- Verify cron secret ---
    const secret = request.headers.get('authorization')?.replace('Bearer ', '')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || secret !== cronSecret) {
      return Response.json(
        { error: 'Unauthorized', code: 'CRON_SECRET_INVALID' },
        { status: 401 },
      )
    }

    const supabase = await createClient()

    // --- Find councils completed 30+ days ago with no outcome ---
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Get all completed councils older than 30 days
    const { data: councils, error: councilsError } = await supabase
      .from('councils')
      .select('id, user_id, title, question, completed_at')
      .eq('status', 'complete')
      .lte('completed_at', thirtyDaysAgo.toISOString())
      .order('completed_at', { ascending: true })

    if (councilsError) {
      return Response.json(
        { error: 'Failed to query councils', code: 'DB_ERROR' },
        { status: 500 },
      )
    }

    if (!councils || councils.length === 0) {
      return Response.json({ reminders: [], count: 0 })
    }

    // Get all existing outcomes for these councils
    const councilIds = councils.map((c) => c.id)
    const { data: existingOutcomes } = await supabase
      .from('decision_outcomes')
      .select('council_id')
      .in('council_id', councilIds)

    const outcomeSet = new Set(
      (existingOutcomes || []).map((o) => o.council_id),
    )

    // Filter to only councils WITHOUT an outcome
    const needsReminder = councils.filter((c) => !outcomeSet.has(c.id))

    // Group by user for future email batching
    const byUser: Record<string, typeof needsReminder> = {}
    for (const council of needsReminder) {
      const uid = council.user_id
      if (!byUser[uid]) byUser[uid] = []
      byUser[uid].push(council)
    }

    return Response.json({
      reminders: needsReminder.map((c) => ({
        council_id: c.id,
        user_id: c.user_id,
        title: c.title,
        completed_at: c.completed_at,
        days_ago: Math.floor(
          (Date.now() - new Date(c.completed_at).getTime()) / (1000 * 60 * 60 * 24),
        ),
      })),
      count: needsReminder.length,
      users_affected: Object.keys(byUser).length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return Response.json(
      { error: message, code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
