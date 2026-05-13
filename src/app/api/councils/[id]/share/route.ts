import { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'
import { createClient } from '@/lib/supabase/server'
import { AuthError, errorResponse } from '@/lib/errors'

function buildShareUrl(request: NextRequest, token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const baseUrl = appUrl && appUrl.trim().length > 0 ? appUrl : request.nextUrl.origin
  return `${baseUrl.replace(/\/+$/, '')}/shared/${token}`
}

async function fetchOwnedCouncil(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  userId: string
) {
  const { data: council, error } = await supabase
    .from('councils')
    .select('id, user_id, share_token')
    .eq('id', id)
    .single()

  if (error || !council) {
    return { council: null, status: 404 as const, error: 'Council not found' }
  }

  if (council.user_id !== userId) {
    return { council: null, status: 403 as const, error: 'Not authorized' }
  }

  return { council, status: 200 as const, error: null }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) throw new AuthError()

    const owned = await fetchOwnedCouncil(supabase, id, user.id)
    if (!owned.council) {
      return Response.json({ error: owned.error, code: owned.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN' }, { status: owned.status })
    }

    if (owned.council.share_token) {
      return Response.json({
        shareToken: owned.council.share_token,
        shareUrl: buildShareUrl(request, owned.council.share_token),
      })
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const shareToken = nanoid(18)
      const { data, error } = await supabase
        .from('councils')
        .update({ share_token: shareToken })
        .eq('id', id)
        .eq('user_id', user.id)
        .select('share_token')
        .single()

      if (!error && data?.share_token) {
        return Response.json({
          shareToken: data.share_token,
          shareUrl: buildShareUrl(request, data.share_token),
        })
      }

      if (error?.code !== '23505') {
        throw error
      }
    }

    return Response.json(
      { error: 'Failed to generate a unique share link', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) throw new AuthError()

    const owned = await fetchOwnedCouncil(supabase, id, user.id)
    if (!owned.council) {
      return Response.json({ error: owned.error, code: owned.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN' }, { status: owned.status })
    }

    const { error } = await supabase
      .from('councils')
      .update({ share_token: null })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    return Response.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
