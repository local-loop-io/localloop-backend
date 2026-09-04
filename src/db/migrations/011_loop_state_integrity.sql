-- 011_loop_state_integrity.sql
-- Enforce the MaterialDNA -> Offer -> Match -> Transfer state machine at the DB level.
--
-- Before this migration, loop_matches.offer_id and loop_transfers.match_id were plain
-- foreign keys with no uniqueness, so the same offer could be matched (and the same
-- match transferred) any number of times, including concurrently. These partial unique
-- indexes make "one active match per offer" and "one live transfer per match" invariants
-- that the database guarantees regardless of application code; a losing concurrent write
-- raises 23505, which the API maps to HTTP 409.
--
-- NOTE (lab demo): if a database already holds rows that violate these invariants from
-- earlier un-constrained runs, creating the unique indexes will fail. Reset the lab DB
-- (docker compose down -v) and re-run migrations + seed in that case.

-- One active match per offer. proposed/accepted are "live"; rejected/expired free the offer.
CREATE UNIQUE INDEX IF NOT EXISTS uq_loop_matches_active_offer
  ON loop_matches (offer_id)
  WHERE status IN ('proposed', 'accepted');

-- One non-cancelled transfer per match.
CREATE UNIQUE INDEX IF NOT EXISTS uq_loop_transfers_active_match
  ON loop_transfers (match_id)
  WHERE status <> 'cancelled';

-- Constrain status domains at the DB level (defence in depth alongside schema validation).
-- DROP ... IF EXISTS first so the file stays re-runnable (e.g. a restored database whose
-- schema_migrations rows were lost).
ALTER TABLE loop_offers DROP CONSTRAINT IF EXISTS chk_loop_offers_status;
ALTER TABLE loop_offers
  ADD CONSTRAINT chk_loop_offers_status
  CHECK (status IN ('open', 'reserved', 'withdrawn'));

ALTER TABLE loop_matches DROP CONSTRAINT IF EXISTS chk_loop_matches_status;
ALTER TABLE loop_matches
  ADD CONSTRAINT chk_loop_matches_status
  CHECK (status IN ('proposed', 'accepted', 'rejected', 'expired'));

ALTER TABLE loop_transfers DROP CONSTRAINT IF EXISTS chk_loop_transfers_status;
ALTER TABLE loop_transfers
  ADD CONSTRAINT chk_loop_transfers_status
  CHECK (status IN ('scheduled', 'in_transit', 'completed', 'cancelled'));
