CREATE TABLE IF NOT EXISTS federation_nodes (
  node_id    TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  endpoint   TEXT NOT NULL,
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_federation_nodes_last_seen ON federation_nodes (last_seen DESC);
