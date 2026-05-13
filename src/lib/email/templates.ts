import 'server-only'

// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b; }
  .wrap { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .header { background: #18181b; padding: 28px 32px; }
  .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
  .body { padding: 32px; }
  .body p { margin: 0 0 16px; line-height: 1.6; color: #3f3f46; font-size: 15px; }
  .body p:last-child { margin-bottom: 0; }
  .btn { display: inline-block; margin-top: 8px; padding: 12px 24px; background: #18181b; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; }
  .footer { padding: 20px 32px; border-top: 1px solid #f4f4f5; }
  .footer p { margin: 0; font-size: 12px; color: #a1a1aa; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header"><h1>Metamorph ⚖️</h1></div>
  <div class="body">${body}</div>
  <div class="footer"><p>You're receiving this because you have a Metamorph account. &copy; ${new Date().getFullYear()} Metamorph.</p></div>
</div>
</body>
</html>`
}

// ─── Templates ────────────────────────────────────────────────────────────────

export type EmailTemplate = 'welcome' | 'council-complete' | 'credits-low' | 'outcome-reminder'

export interface EmailPayload {
  subject: string
  html: string
}

export function buildWelcome(): EmailPayload {
  return {
    subject: 'Welcome to Metamorph',
    html: layout(`
      <p>You're in. Metamorph gives you a board of five independent AI advisors who debate your toughest decisions, peer-review each other, and deliver a structured verdict.</p>
      <p>Head to your dashboard to submit your first question.</p>
      <a class="btn" href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">Open Dashboard</a>
    `),
  }
}

export function buildCouncilComplete(opts: {
  question: string
  councilId: string
}): EmailPayload {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/council/${opts.councilId}`
  const short = opts.question.length > 80 ? opts.question.slice(0, 80) + '…' : opts.question
  return {
    subject: 'Your council verdict is ready',
    html: layout(`
      <p>Your advisors have reached a verdict on:</p>
      <p style="font-style:italic;color:#18181b;">"${short}"</p>
      <p>Read the full deliberation, advisor responses, and final recommendation below.</p>
      <a class="btn" href="${url}">View Verdict</a>
    `),
  }
}

export function buildCreditsLow(): EmailPayload {
  return {
    subject: 'You have 1 credit remaining',
    html: layout(`
      <p>Just a heads-up — you're down to <strong>1 credit</strong> on your Metamorph plan.</p>
      <p>Upgrade to keep your advisory board running without interruption.</p>
      <a class="btn" href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings">Upgrade Plan</a>
    `),
  }
}

export function buildOutcomeReminder(opts: {
  question: string
  councilId: string
}): EmailPayload {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/council/${opts.councilId}`
  const short = opts.question.length > 80 ? opts.question.slice(0, 80) + '…' : opts.question
  return {
    subject: 'How did your decision turn out?',
    html: layout(`
      <p>30 days ago your council weighed in on:</p>
      <p style="font-style:italic;color:#18181b;">"${short}"</p>
      <p>Looking back, how did it go? Recording the outcome helps you calibrate your decision-making over time.</p>
      <a class="btn" href="${url}">Record Outcome</a>
    `),
  }
}

export function buildTemplate(
  template: EmailTemplate,
  data: Record<string, string> = {},
): EmailPayload {
  switch (template) {
    case 'welcome':
      return buildWelcome()
    case 'council-complete':
      return buildCouncilComplete({ question: data.question ?? '', councilId: data.councilId ?? '' })
    case 'credits-low':
      return buildCreditsLow()
    case 'outcome-reminder':
      return buildOutcomeReminder({ question: data.question ?? '', councilId: data.councilId ?? '' })
  }
}
