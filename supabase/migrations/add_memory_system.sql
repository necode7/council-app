-- ================================================================
-- Migration: Memory Retrieval System (Phase 2 — Steps 2.1, 2.2)
-- ================================================================
-- Adds:
--   1. pgvector extension
--   2. decision_embeddings table (stores embedded summaries of past councils)
--   3. user_memory table (goals, projects, preferences)
--   4. match_decisions() RPC for cosine-similarity search
-- ================================================================

-- 1. Enable pgvector (Supabase has this available)
CREATE EXTENSION IF NOT EXISTS vector;

-- ────────────────────────────────────────────────────────────────
-- DECISION EMBEDDINGS
-- Stores a 1536-dim embedding of each council's question+verdict
-- for semantic similarity search against future questions.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decision_embeddings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  council_id  UUID REFERENCES councils(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  embedding   vector(1536),
  summary     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS decision_embeddings_embedding_idx
  ON decision_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- ────────────────────────────────────────────────────────────────
-- USER MEMORY
-- Stores user's goals, active projects, and preferences.
-- These are surfaced to advisors as context.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_memory (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────
ALTER TABLE decision_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "embeddings: own rows" ON decision_embeddings;
CREATE POLICY "embeddings: own rows" ON decision_embeddings
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_memory: own rows" ON user_memory;
CREATE POLICY "user_memory: own rows" ON user_memory
  FOR ALL USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────
-- MATCH_DECISIONS RPC
-- Cosine-similarity search over a user's past decision embeddings.
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS match_decisions(vector, uuid, integer);
DROP FUNCTION IF EXISTS match_decisions(vector, uuid, integer, float);

CREATE OR REPLACE FUNCTION match_decisions(
  query_embedding vector(1536),
  match_user_id   uuid,
  match_count     int DEFAULT 3
)
RETURNS TABLE(council_id uuid, summary text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT council_id, summary,
         1 - (embedding <=> query_embedding) AS similarity
  FROM   decision_embeddings
  WHERE  user_id = match_user_id
  ORDER  BY embedding <=> query_embedding
  LIMIT  match_count;
$$;
