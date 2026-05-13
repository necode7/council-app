import 'server-only'
import { Resend } from 'resend'

// Resend is optional — only used when RESEND_API_KEY is configured.
// Calling resend.emails.send() without a key will fail at runtime, not build time.
export const resend = new Resend(process.env.RESEND_API_KEY ?? 'placeholder')

export const FROM_ADDRESS = 'Metamorph <noreply@send.metamorp.live>'
