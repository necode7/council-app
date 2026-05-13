ALTER TABLE councils
ADD COLUMN IF NOT EXISTS share_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_councils_share_token
ON councils (share_token);
