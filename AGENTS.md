<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Council App — Shared Agent Context

**All AI tools (Claude Code, Codex, Antigravity, Gemini CLI) work directly in:**
`C:\Users\Administrator\Desktop\council-app\`

Never create files outside this directory. Never use git worktrees. Always work on the `main` branch unless explicitly told otherwise.

---

## What This App Is

**Metamorph / Council** — a SaaS AI Advisory Board product.
- User submits a question/decision
- 5 AI advisors (different models) respond in parallel
- Advisors peer-review each other (anonymized)
- A Chairman model synthesizes a structured verdict
- Results saved to Supabase, shown to user

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Auth + DB | Supabase (Auth + PostgreSQL + RLS) |
| AI | OpenRouter API (multi-model) |
| Payments | Razorpay (not yet built) |

---

## Environment Variables (in .env.local — never commit)

```
NEXT_PUBLIC_SUPABASE_URL=https://jqavmupejklmkthbafxz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<jwt>
OPENROUTER_API_KEY=sk-or-v1-<key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Key Files & What They Do

```
src/lib/ai/openrouter.ts        — callModel() helper, MODEL_CONFIG, retry logic (SERVER ONLY)
src/lib/council/pipeline.ts     — runCouncil(), runAdvisors(), runPeerReview(), runChairman()
src/lib/council/prompts.ts      — All prompt templates + inject() helper
src/lib/supabase/server.ts      — Supabase server client (SSR, reads cookies)
src/lib/supabase/client.ts      — Supabase browser client
src/app/dashboard/layout.tsx    — Auth guard + sidebar layout
src/app/dashboard/page.tsx      — Dashboard home (stats + recent decisions)
src/components/Sidebar.tsx      — Nav sidebar (client component)
```

---

## MODEL_CONFIG (do not change without discussion)

```typescript
chairman:  'anthropic/claude-opus-4.7'
advisors:  ['openai/gpt-5.5', 'google/gemini-3.1-pro-preview',
            'anthropic/claude-sonnet-4.6', 'x-ai/grok-4.3', 'deepseek/deepseek-v4-pro']
clarifier: 'anthropic/claude-haiku-4.5'
slugger:   'anthropic/claude-haiku-4.5'
```

---

## callModel() Signature — Always Use This

```typescript
// SERVER ONLY — import from @/lib/ai/openrouter
await callModel({
  model: string,
  system: string,
  user: string,
  temperature?: number,   // default 0.7
  maxTokens?: number,     // default 2048
  label: string,          // for logging
})
```

**Never use `systemPrompt`, `userPrompt`, or `prompt` — they don't exist.**

---

## Supabase Tables (already migrated)

- `profiles` — user profile, credits_remaining, plan
- `councils` — id, user_id, question, slug, advisor_responses (jsonb), letter_map (jsonb), reviews (jsonb), verdict, created_at
- `templates` — id, user_id, name, advisor_panel (jsonb), chairman_prompt, is_public

---

## Steps Completed

- [x] 0.1 — Project scaffold (Next.js + Tailwind + Supabase)
- [x] 0.2 — Supabase schema + RLS migrations
- [x] 0.3 — Auth pages (login, signup, callback)
- [x] 0.4 — Landing page
- [x] 0.7 — Dashboard layout + sidebar
- [x] 0.8 — OpenRouter AI provider layer (`src/lib/ai/openrouter.ts`)
- [x] 0.9 — Council pipeline (`src/lib/council/pipeline.ts` + `prompts.ts`)

## Steps Remaining (build in order)

- [ ] 0.10 — API routes: `POST /api/councils`, `GET /api/councils/[id]`, `GET /api/councils/[id]/pdf`
- [ ] 1.1  — New Council page (`/dashboard/new`) — question input + submit
- [ ] 1.2  — Results page (`/dashboard/councils/[id]`) — show verdict + advisor tabs
- [ ] 1.3  — Archive page (`/dashboard/decisions`) — list past councils
- [ ] 1.4  — Settings page (`/dashboard/settings`) — profile + credits
- [ ] 1.5  — Credits system + Razorpay integration
- [ ] 1.6  — Custom advisor templates (CRUD)
- [ ] 1.7  — PDF export (real PDF generation)
- [ ] 1.8  — Memory/context injection (user background fed to advisors)

---

## Rules All Agents Must Follow

1. **Server-only AI code** — any file importing `openrouter.ts` must be a Server Component or Route Handler. Add `import 'server-only'` if needed.
2. **No worktrees** — work directly in the project root.
3. **No `Promise.all` for advisor calls** — always use `Promise.allSettled` so one failure doesn't kill the whole pipeline.
4. **Tailwind v4 syntax** — no `tailwind.config.js` class extensions; use CSS variables and `@theme` in globals.css instead.
5. **Check before creating** — always verify a file doesn't already exist before writing it.
6. **Don't run the dev server** unless explicitly asked.
