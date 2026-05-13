import 'server-only'
import { type NextRequest } from 'next/server'
import { resend, FROM_ADDRESS } from '@/lib/email/client'
import { buildTemplate, type EmailTemplate } from '@/lib/email/templates'
import { AuthError, ValidationError, errorResponse } from '@/lib/errors'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-internal-key')
    if (!authHeader || authHeader !== process.env.INTERNAL_API_KEY) {
      throw new AuthError('Unauthorized')
    }

    let body: { to: string; template: EmailTemplate; data?: Record<string, string> }
    try {
      body = await request.json()
    } catch {
      throw new ValidationError('Invalid JSON')
    }

    const { to, template, data = {} } = body

    if (!to || !template) {
      throw new ValidationError('Missing required fields: to, template')
    }

    const { subject, html } = buildTemplate(template, data)

    const { data: result, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    })

    if (error) {
      console.error('[email/send] Resend error:', error)
      return Response.json({ error: error.message, code: 'EMAIL_ERROR' }, { status: 500 })
    }

    return Response.json({ id: result?.id })
  } catch (error) {
    return errorResponse(error)
  }
}
