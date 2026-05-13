import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/ai/embeddings'

export interface SimilarDecision {
  summary: string
  similarity_score: number
  council_id: string
}

export async function saveDecisionEmbedding(
  councilId: string,
  userId: string,
  question: string,
  verdict: string,
): Promise<void> {
  const summary = `${question.slice(0, 200)} | ${verdict.slice(0, 200)}`
  const embedding = await embedText(summary)

  const supabase = await createClient()
  const { error } = await supabase.from('decision_embeddings').insert({
    council_id: councilId,
    user_id: userId,
    summary,
    embedding: JSON.stringify(embedding),
  })

  if (error) {
    console.error('[saveDecisionEmbedding] failed:', error.message)
  }
}

export async function findSimilarDecisions(
  userId: string,
  question: string,
  limit = 3,
): Promise<SimilarDecision[]> {
  const embedding = await embedText(question)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('match_decisions', {
    query_embedding: JSON.stringify(embedding),
    match_user_id: userId,
    match_count: limit,
  })

  if (error) {
    console.error('[findSimilarDecisions] failed:', error.message)
    return []
  }

  return (
    data ?? []
  ).map((row: { summary: string; similarity: number; council_id: string }) => ({
    summary: row.summary,
    similarity_score: row.similarity,
    council_id: row.council_id,
  }))
}
