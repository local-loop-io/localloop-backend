-- 014_loop_idempotency.sql
-- REST-level idempotency for the Core-DP lifecycle write endpoints (material, product,
-- offer, match, transfer). A client retrying a request after a dropped response supplies
-- the same Idempotency-Key header; a differing request body under the same key is a
-- conflict rather than being silently applied twice.
CREATE TABLE IF NOT EXISTS loop_idempotency_keys (
  key TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  request_hash_sha256 TEXT NOT NULL,
  response_status INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loop_idempotency_created_at ON loop_idempotency_keys (created_at);
