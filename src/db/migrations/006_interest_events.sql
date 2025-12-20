CREATE TABLE IF NOT EXISTS interest_events (
  id BIGSERIAL PRIMARY KEY,
  interest_id BIGINT NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interest_events_interest_id_idx ON interest_events (interest_id);
CREATE INDEX IF NOT EXISTS interest_events_created_at_idx ON interest_events (created_at DESC);
