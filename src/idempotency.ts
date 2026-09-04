import type { PoolClient } from 'pg';
import { pool } from './db/pool';
import { canonicalHash } from './crypto/canonical';
import { CoreDpError } from './errors';

type CachedResponse = { status: number; body: unknown };

/**
 * How long a cached Idempotency-Key response is honored. Past this, the key is
 * treated as if it were never used: a request bearing an expired key runs
 * `handler` fresh and overwrites the old cache row (rather than replaying stale
 * data or permanently conflicting). This bounds how long a key can be
 * "squatted" — this profile's single-shared-API-key auth model has no caller
 * identity to scope keys to, so an expiry window is the lightweight mitigation
 * available without inventing new auth infrastructure. It also keeps the
 * table from growing unboundedly; see scripts/cleanup-idempotency-keys.ts for
 * purging rows past this window entirely.
 */
export const IDEMPOTENCY_RETENTION_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * REST-level idempotency keyed on the client-supplied `Idempotency-Key` header.
 * Same key + same body within the retention window replays the cached
 * response; same key + a different body within the window is a conflict.
 *
 * Concurrent first-time requests for the same new key are serialized with a
 * Postgres advisory lock scoped to the key: only the first racer runs `handler`
 * and writes the cache row, and every other racer blocks until that row exists,
 * then replays it. Without this, two truly concurrent requests could both run
 * `handler` and hit the underlying create operations' own uniqueness/state
 * invariants, producing two *different* HTTP responses (e.g. 201 for one, 409/400
 * for the other) for what the client believes is a single retried request —
 * defeating the purpose of the Idempotency-Key contract.
 *
 * The advisory lock is a *session* lock, so the client holding it stays
 * checked out for the whole call. That same client is handed to `handler` so
 * the underlying create can run its transaction on it (see
 * `withTransaction`'s `existing` parameter) instead of waiting for a second
 * pool slot; without this, `DB_POOL_SIZE` concurrent keyed writes deadlock
 * until the connection timeout and fail with 500s.
 */
export async function withIdempotency(
  route: string,
  key: string | undefined,
  requestBody: unknown,
  handler: (client?: PoolClient) => Promise<CachedResponse>,
): Promise<CachedResponse> {
  if (!key) {
    return handler();
  }

  const requestHash = canonicalHash(requestBody);
  const cutoff = new Date(Date.now() - IDEMPOTENCY_RETENTION_MS);

  const lockClient = await pool.connect();
  try {
    await lockClient.query('SELECT pg_advisory_lock(hashtext($1))', [key]);
    try {
      const { rows } = await lockClient.query(
        'SELECT request_hash_sha256, response_status, response_body FROM loop_idempotency_keys WHERE key = $1 AND route = $2 AND created_at >= $3',
        [key, route, cutoff],
      );
      const existing = rows[0] as
        | { request_hash_sha256: string; response_status: number; response_body: unknown }
        | undefined;

      if (existing) {
        if (existing.request_hash_sha256 !== requestHash) {
          throw new CoreDpError('conflict', `Idempotency-Key '${key}' was already used with a different request body`, {
            details: { idempotency_key: key },
          });
        }
        return { status: existing.response_status, body: existing.response_body };
      }

      const result = await handler(lockClient);

      await lockClient.query(
        `INSERT INTO loop_idempotency_keys (key, route, request_hash_sha256, response_status, response_body, created_at)
         VALUES ($1,$2,$3,$4,$5,NOW())
         ON CONFLICT (key, route) DO UPDATE SET
           request_hash_sha256 = EXCLUDED.request_hash_sha256,
           response_status = EXCLUDED.response_status,
           response_body = EXCLUDED.response_body,
           created_at = EXCLUDED.created_at`,
        [key, route, requestHash, result.status, result.body],
      );

      return result;
    } finally {
      await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [key]);
    }
  } finally {
    lockClient.release();
  }
}
