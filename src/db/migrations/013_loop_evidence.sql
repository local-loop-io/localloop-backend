-- 013_loop_evidence.sql
-- Core-DP append-only evidence log, matching
-- profiles/core-dp/schemas/evidence-entry.schema.json. Distinct from loop_events
-- (a generic SSE/relay feed): loop_evidence is the immutable lifecycle record
-- surfaced by GET /api/v1/evidence. A trigger blocks UPDATE/DELETE so the
-- append-only guarantee holds at the database level, not just in application code.
--
-- NOTE (lab demo): `sequence` is a single global sequence rather than per-node_id,
-- since this profile runs as one node by default. A real multi-node deployment would
-- need a per-node_id sequence; out of scope for this lab preview.
CREATE SEQUENCE IF NOT EXISTS loop_evidence_sequence;

CREATE TABLE IF NOT EXISTS loop_evidence (
  event_id TEXT PRIMARY KEY,
  sequence BIGINT NOT NULL DEFAULT nextval('loop_evidence_sequence'),
  predecessor_event_id TEXT REFERENCES loop_evidence(event_id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observed_at TIMESTAMPTZ,
  node_id TEXT NOT NULL,
  actor_node_id TEXT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('material', 'product', 'offer', 'match', 'transfer', 'envelope')),
  subject_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'registered', 'read', 'searched',
    'offer-published', 'offer-acked', 'offer-rejected',
    'match-proposed', 'match-accepted', 'match-rejected',
    'transfer-dispatched', 'transfer-received', 'transfer-acked',
    'error-recorded', 'key-rotated'
  )),
  immutable JSONB NOT NULL,
  payload_hash_sha256 TEXT NOT NULL CHECK (payload_hash_sha256 ~ '^[a-f0-9]{64}$'),
  envelope_message_id TEXT,
  retain_until TIMESTAMPTZ NOT NULL,
  exportable BOOLEAN NOT NULL DEFAULT true,
  redaction_status TEXT NOT NULL DEFAULT 'none' CHECK (redaction_status IN ('none', 'redacted', 'tombstoned')),
  redaction_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_loop_evidence_subject ON loop_evidence (subject_type, subject_id, sequence);
CREATE INDEX IF NOT EXISTS idx_loop_evidence_sequence ON loop_evidence (sequence);

CREATE OR REPLACE FUNCTION loop_evidence_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'loop_evidence is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_loop_evidence_no_update ON loop_evidence;
CREATE TRIGGER trg_loop_evidence_no_update
  BEFORE UPDATE OR DELETE ON loop_evidence
  FOR EACH ROW EXECUTE FUNCTION loop_evidence_append_only();

-- Row-level BEFORE UPDATE OR DELETE triggers never fire for TRUNCATE (a separate
-- statement-level trigger on the TRUNCATE event is required), so without this the
-- append-only guarantee above could be bypassed entirely by TRUNCATE.
DROP TRIGGER IF EXISTS trg_loop_evidence_no_truncate ON loop_evidence;
CREATE TRIGGER trg_loop_evidence_no_truncate
  BEFORE TRUNCATE ON loop_evidence
  FOR EACH STATEMENT EXECUTE FUNCTION loop_evidence_append_only();
