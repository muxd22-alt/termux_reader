CREATE TABLE IF NOT EXISTS api_keys (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  key_hash     TEXT    NOT NULL UNIQUE,
  key_prefix   TEXT    NOT NULL,
  scopes       TEXT    NOT NULL DEFAULT 'read',
  last_used_at TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
