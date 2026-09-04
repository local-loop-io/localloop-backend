-- 016_loop_evidence_status_updated.sql
-- Additive: widens loop_evidence.event_type to accept 'status-updated', matching
-- profiles/core-dp/schemas/evidence-entry.schema.json. Closes the gap where
-- MaterialStatusUpdate (POST /api/v1/material-status) relayed only to loop_events
-- (mutable SSE feed) and never reached the append-only evidence log.
ALTER TABLE loop_evidence DROP CONSTRAINT IF EXISTS loop_evidence_event_type_check;

ALTER TABLE loop_evidence ADD CONSTRAINT loop_evidence_event_type_check CHECK (event_type IN (
  'registered', 'read', 'searched',
  'offer-published', 'offer-acked', 'offer-rejected',
  'match-proposed', 'match-accepted', 'match-rejected',
  'transfer-dispatched', 'transfer-received', 'transfer-acked',
  'status-updated',
  'error-recorded', 'key-rotated'
));
