import 'server-only'
import { resend, FROM_ADDRESS } from './client'
import { buildTemplate, type EmailTemplate } from './templates'

export async function sendEmail(opts: {
  to: string
  template: EmailTemplate
  data?: Record<string, string>
}): Promise<void> {
  const { subject, html } = buildTemplate(opts.template, opts.data ?? {})
  const { error } = await resend.emails.send({ from: FROM_ADDRESS, to: opts.to, subject, html })
  if (error) {
    console.error(`[email] Failed to send "${opts.template}" to ${opts.to}:`, error)
  }
}
