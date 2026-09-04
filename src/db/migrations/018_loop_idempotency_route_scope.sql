-- 018_loop_idempotency_route_scope.sql
-- Idempotency-Key cache rows are looked up by (key, route) (src/idempotency.ts), but
-- 014 keyed the table on `key` alone and the INSERT used ON CONFLICT (key). Reusing one
-- key on two different routes therefore overwrote the first route's cached response,
-- and a legitimate retry of the first request then re-ran its handler. Scope the
-- primary key to (key, route). No duplicate (key, route) pairs can exist because `key`
-- alone was unique until now, so the ADD cannot fail on existing data.
ALTER TABLE loop_idempotency_keys DROP CONSTRAINT IF EXISTS loop_idempotency_keys_pkey;
ALTER TABLE loop_idempotency_keys ADD CONSTRAINT loop_idempotency_keys_pkey PRIMARY KEY (key, route);
