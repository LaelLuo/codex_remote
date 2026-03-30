-- Independent Anchor device sessions for Orbit opaque access/refresh tokens
CREATE TABLE IF NOT EXISTS anchor_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  access_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  access_expires_at INTEGER NOT NULL,
  refresh_expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES passkey_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_anchor_sessions_user ON anchor_sessions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_anchor_sessions_revoked ON anchor_sessions(revoked_at, access_expires_at);
