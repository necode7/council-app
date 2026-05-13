-- ============================================================
-- Council App — pgvector Setup for Decision Similarity Search
-- ============================================================
-- Run this in the Supabase SQL Editor (one-time migration).
-- Prerequisite: the `councils` and `profiles` tables must
-- already exist from the main schema.sql migration.
-- ============================================================

-- 1. Enable the pgvector extension
-- ============================================================
-- Supabase makes extensions available but they must be
-- explicitly enabled per-project. This is idempotent.
CREATE EXTENSION IF NOT EXISTS vector
  WITH SCHEMA extensions;

-- 2. Create the decision_embeddings table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.decision_embeddings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id UUID NOT NULL REFERENCES public.councils(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  embedding  vector(1536) NOT NULL,  -- OpenAI text-embedding-3-small dimensionality
  summary    TEXT NOT NULL,           -- human-readable summary for display
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: fast lookup by user (most queries filter by user first)
CREATE INDEX IF NOT EXISTS idx_decision_embeddings_user_id
  ON public.decision_embeddings (user_id);

-- Index: fast lookup by council
CREATE INDEX IF NOT EXISTS idx_decision_embeddings_council_id
  ON public.decision_embeddings (council_id);

-- 3. Vector similarity index (HNSW — preferred over IVFFlat)
-- ============================================================
-- HNSW doesn't need a separate build step and has better recall
-- at the cost of slightly more memory. For our scale (hundreds to
-- low thousands of embeddings per user) this is the right choice.
-- Operator: vector_cosine_ops for cosine distance (<=>).
CREATE INDEX IF NOT EXISTS idx_decision_embeddings_hnsw
  ON public.decision_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Row-Level Security
-- ============================================================
ALTER TABLE public.decision_embeddings ENABLE ROW LEVEL SECURITY;

-- Users can only read their own embeddings
CREATE POLICY "Users can view own embeddings"
  ON public.decision_embeddings
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own embeddings
CREATE POLICY "Users can insert own embeddings"
  ON public.decision_embeddings
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own embeddings
CREATE POLICY "Users can delete own embeddings"
  ON public.decision_embeddings
  FOR DELETE
  USING (user_id = auth.uid());

-- Service role (used by API routes) bypasses RLS via the service key,
-- so no extra policy is needed for server-side inserts.

-- 5. Similarity search function
-- ============================================================
-- Returns the top N most similar past decisions for a given user
-- using cosine distance (lower = more similar).
--
-- Usage from Supabase client:
--   const { data } = await supabase.rpc('match_decisions', {
--     query_embedding: [0.1, 0.2, ...],  // 1536-dim float array
--     match_user_id: 'uuid-here',
--     match_count: 3,
--   })
CREATE OR REPLACE FUNCTION public.match_decisions(
  query_embedding vector(1536),
  match_user_id   UUID,
  match_count     INT DEFAULT 3
)
RETURNS TABLE (
  id              UUID,
  council_id      UUID,
  summary         TEXT,
  similarity      FLOAT,
  created_at      TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER                      -- runs as function owner (bypasses RLS)
SET search_path = public, extensions  -- ensure vector operators resolve
AS $$
  SELECT
    de.id,
    de.council_id,
    de.summary,
    -- Cosine similarity = 1 - cosine distance
    -- The <=> operator returns cosine distance (0 = identical, 2 = opposite)
    1 - (de.embedding <=> query_embedding) AS similarity,
    de.created_at
  FROM public.decision_embeddings de
  WHERE de.user_id = match_user_id
  ORDER BY de.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

-- Grant execute to authenticated users (needed for RPC calls)
GRANT EXECUTE ON FUNCTION public.match_decisions TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_decisions TO service_role;

-- ============================================================
-- Done. Verify with:
--   SELECT * FROM pg_extension WHERE extname = 'vector';
--   SELECT count(*) FROM decision_embeddings;
--   SELECT match_decisions(
--     '[0.1,0.2,...]'::vector(1536),
--     'your-user-uuid',
--     3
--   );
-- ============================================================
