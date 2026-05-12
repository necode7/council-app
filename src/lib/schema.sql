-- ============================================================
-- COUNCIL — Complete Supabase Database Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================

-- Enable pgvector for semantic memory search (Phase 2)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: profiles
-- Extends Supabase auth.users with app-specific data
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  full_name         TEXT,
  avatar_url        TEXT,
  -- Subscription plan
  plan              TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team')),
  -- Credits for running councils
  credits_remaining INTEGER NOT NULL DEFAULT 5 CHECK (credits_remaining >= 0),
  credits_reset_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  -- Professional context (used in memory injection)
  domain            TEXT,              -- e.g. 'Legal', 'Finance', 'Healthcare'
  bio               TEXT,              -- Short description: "I run a 20-person CA firm..."
  preferences       JSONB DEFAULT '{}', -- { risk_tolerance: 'conservative', ... }
  -- Referral system (Phase 3)
  referral_code     TEXT UNIQUE,
  referred_by       UUID REFERENCES profiles(id),
  referral_count    INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);

-- ============================================================
-- TABLE: templates
-- Domain-specific advisor panel configurations
-- ============================================================

CREATE TABLE IF NOT EXISTS templates (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug           TEXT UNIQUE NOT NULL,  -- e.g. 'contract-review'
  name           TEXT NOT NULL,         -- e.g. 'Contract Review'
  description    TEXT NOT NULL,
  category       TEXT NOT NULL,         -- 'Legal', 'Finance', 'Healthcare', etc.
  -- JSON array of form fields: [{key, label, type, options?, required?}]
  intake_schema  JSONB NOT NULL DEFAULT '[]',
  -- Array of 5 advisor configs: [{name, role_description, system_prompt}]
  advisor_panel  JSONB NOT NULL DEFAULT '[]',
  -- The chairman's specific framing for this template
  chairman_prompt TEXT,
  is_public      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_slug ON templates(slug);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON templates(is_public);

-- ============================================================
-- TABLE: councils
-- Each individual advisory session / council run
-- ============================================================

CREATE TABLE IF NOT EXISTS councils (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id        UUID REFERENCES templates(id),  -- NULL for custom/free-form
  -- The question / decision being analyzed
  title              TEXT,             -- Auto-generated topic slug (display name)
  question           TEXT NOT NULL,
  context            JSONB DEFAULT '{}', -- Structured intake answers
  -- Pipeline status
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','running','advisors','review','chairman','complete','failed')),
  -- Pipeline outputs (stored as JSON for flexibility)
  advisor_responses  JSONB DEFAULT '{}', -- { advisorName: responseText }
  reviews            JSONB DEFAULT '{}', -- { advisorName: reviewText }
  letter_map         JSONB DEFAULT '{}', -- { A: 'Contrarian', B: 'First Principles', ... }
  verdict            TEXT,               -- Chairman's final verdict (markdown)
  -- Metadata
  model_config       JSONB DEFAULT '{}', -- Which models were used
  model_cost_usd     REAL DEFAULT 0,
  -- Sharing (Phase 3)
  share_token        TEXT UNIQUE,
  -- Timestamps
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_councils_user_id ON councils(user_id);
CREATE INDEX IF NOT EXISTS idx_councils_created_at ON councils(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_councils_status ON councils(status);
CREATE INDEX IF NOT EXISTS idx_councils_share_token ON councils(share_token);

-- ============================================================
-- TABLE: user_memory
-- Persistent memory items (projects, goals, preferences, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_memory (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  memory_type  TEXT NOT NULL
               CHECK (memory_type IN ('project', 'goal', 'preference', 'context', 'pattern')),
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  -- Optional structured data (e.g. { key: 'Risk Tolerance', value: 'Conservative' })
  metadata     JSONB DEFAULT '{}',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ  -- NULL = never expires
);

CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_type ON user_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memory_active ON user_memory(is_active);

-- ============================================================
-- TABLE: decision_embeddings
-- Vector embeddings for semantic memory retrieval (Phase 2)
-- ============================================================

CREATE TABLE IF NOT EXISTS decision_embeddings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  council_id  UUID NOT NULL REFERENCES councils(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 1536-dim vector for OpenAI text-embedding-3-small
  embedding   vector(1536),
  -- Human-readable summary for display
  summary     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_embeddings_user_id ON decision_embeddings(user_id);
-- HNSW index for fast approximate nearest-neighbor search
CREATE INDEX IF NOT EXISTS idx_decision_embeddings_vector
  ON decision_embeddings USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- TABLE: decision_outcomes
-- Tracks whether a council decision turned out well (feedback loop)
-- ============================================================

CREATE TABLE IF NOT EXISTS decision_outcomes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  council_id      UUID NOT NULL REFERENCES councils(id) ON DELETE CASCADE,
  outcome         TEXT NOT NULL CHECK (outcome IN ('positive','negative','mixed','pending')),
  outcome_details TEXT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_outcomes_council_id ON decision_outcomes(council_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Users can only see and edit their own data
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE councils ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- profiles: users can read/update only their own row
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- councils: users can CRUD only their own councils
CREATE POLICY "councils_select_own" ON councils
  FOR SELECT USING (
    auth.uid() = user_id
    OR share_token IS NOT NULL  -- allow public access if shared
  );

CREATE POLICY "councils_insert_own" ON councils
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "councils_update_own" ON councils
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "councils_delete_own" ON councils
  FOR DELETE USING (auth.uid() = user_id);

-- user_memory: full CRUD for own rows
CREATE POLICY "user_memory_select_own" ON user_memory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_memory_insert_own" ON user_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_memory_update_own" ON user_memory
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_memory_delete_own" ON user_memory
  FOR DELETE USING (auth.uid() = user_id);

-- decision_embeddings: own rows only
CREATE POLICY "decision_embeddings_select_own" ON decision_embeddings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "decision_embeddings_insert_own" ON decision_embeddings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "decision_embeddings_delete_own" ON decision_embeddings
  FOR DELETE USING (auth.uid() = user_id);

-- decision_outcomes: accessible if council belongs to user
CREATE POLICY "decision_outcomes_select_own" ON decision_outcomes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM councils c
      WHERE c.id = council_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "decision_outcomes_insert_own" ON decision_outcomes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM councils c
      WHERE c.id = council_id AND c.user_id = auth.uid()
    )
  );

-- templates: anyone can read public templates; only creator can write
CREATE POLICY "templates_select_public" ON templates
  FOR SELECT USING (is_public = TRUE OR auth.uid() = created_by);

CREATE POLICY "templates_insert_own" ON templates
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "templates_update_own" ON templates
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "templates_delete_own" ON templates
  FOR DELETE USING (auth.uid() = created_by);

-- ============================================================
-- TRIGGER: Auto-create profile on new auth user signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_referral_code TEXT;
BEGIN
  -- Generate a unique 8-char referral code
  new_referral_code := UPPER(SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 8));

  INSERT INTO profiles (id, email, full_name, avatar_url, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    new_referral_code
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TRIGGER: Auto-update profiles.updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCTION: Semantic memory search (Phase 2)
-- Finds top N most similar past decisions for a user
-- ============================================================

CREATE OR REPLACE FUNCTION match_decisions(
  query_embedding  vector(1536),
  match_user_id    UUID,
  match_count      INT DEFAULT 3
)
RETURNS TABLE (
  id              UUID,
  council_id      UUID,
  summary         TEXT,
  similarity      FLOAT,
  created_at      TIMESTAMPTZ
)
LANGUAGE SQL STABLE AS $$
  SELECT
    de.id,
    de.council_id,
    de.summary,
    1 - (de.embedding <=> query_embedding) AS similarity,
    de.created_at
  FROM decision_embeddings de
  WHERE de.user_id = match_user_id
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- CONSTRAINT: Prevent credits from going negative
-- (belt-and-suspenders on top of app-level check)
-- ============================================================

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS credits_non_negative;

ALTER TABLE profiles
  ADD CONSTRAINT credits_non_negative
  CHECK (credits_remaining >= 0);
