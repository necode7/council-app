/**
 * API Route: /api/councils/[id]
 *
 * GET — Fetch a single council by ID (must belong to the authenticated user)
 */

import { createClient } from '@/lib/supabase/server'
import { AuthError, AppError, errorResponse } from '@/lib/errors'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // --- Authenticate ---
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new AuthError()

    // --- Fetch council ---
    const { data: council, error: fetchError } = await supabase
      .from('councils')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !council) {
      throw new AppError('Council not found', 'NOT_FOUND', 404)
    }

    // --- Verify ownership ---
    if (council.user_id !== user.id) {
      throw new AppError('Not authorized', 'FORBIDDEN', 403)
    }

    return Response.json({ council })
  } catch (error) {
    return errorResponse(error)
  }
}
