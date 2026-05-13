import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { findSimilarDecisions } from '@/lib/memory/store'

interface MemoryRow {
  memory_type: string
  content: string
}

export async function buildMemoryBlock(
  userId: string,
  question: string,
): Promise<string> {
  const supabase = await createClient()

  const [profileResult, memoryResult, similarDecisions] = await Promise.allSettled([
    supabase
      .from('profiles')
      .select('domain, bio')
      .eq('id', userId)
      .single(),
    supabase
      .from('user_memory')
      .select('memory_type, content')
      .eq('user_id', userId)
      .eq('is_active', true),
    findSimilarDecisions(userId, question),
  ])

  const profile =
    profileResult.status === 'fulfilled' ? profileResult.value.data : null
  const memoryItems: MemoryRow[] =
    memoryResult.status === 'fulfilled'
      ? (memoryResult.value.data as MemoryRow[] | null) ?? []
      : []
  const decisions =
    similarDecisions.status === 'fulfilled' ? similarDecisions.value : []

  const hasProfile = profile?.domain || profile?.bio
  const hasMemory = memoryItems.length > 0
  const hasDecisions = decisions.length > 0

  if (!hasProfile && !hasMemory && !hasDecisions) {
    return ''
  }

  const lines: string[] = ['--- YOUR MEMORY OF THIS USER ---']

  if (profile?.domain) lines.push(`Domain: ${profile.domain}`)
  if (profile?.bio) lines.push(`Bio: ${profile.bio}`)

  const goals = memoryItems.filter((m) => m.memory_type === 'goal').map((m) => m.content)
  const projects = memoryItems.filter((m) => m.memory_type === 'project').map((m) => m.content)
  const preferences = memoryItems.filter((m) => m.memory_type === 'preference').map((m) => m.content)

  if (goals.length > 0) lines.push(`Active goals: ${goals.join('; ')}`)
  if (projects.length > 0) lines.push(`Active projects: ${projects.join('; ')}`)
  if (preferences.length > 0) lines.push(`Preferences: ${preferences.join('; ')}`)

  if (hasDecisions) {
    lines.push('')
    lines.push('Relevant past decisions:')
    decisions.forEach((d, i) => {
      const pct = Math.round(d.similarity_score * 100)
      lines.push(`${i + 1}. ${d.summary} (similarity: ${pct}%)`)
    })
  }

  lines.push('--- END MEMORY ---')
  return lines.join('\n')
}
