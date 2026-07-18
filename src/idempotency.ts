import { pool } from './db/pool';
import { canonicalHash } from './crypto/canonical';
import { CoreDpError } from './errors';

type CachedResponse = { status: number; body: unknown };

/**
 * REST-level idempotency keyed on the client-supplied `Idempotency-Key` header.
 * Same key + same body replays the cached response; same key + a different body
 * is a conflict.
 *
 * Concurrent first-time requests for the same new key are serialized with a
 * Postgres advisory lock scoped to the key: only the first racer runs `handler`
 * and writes the cache row, and every other racer blocks until that row exists,
 * then replays it. Without this, two truly concurrent requests could both run
 * `handler` and hit the underlying create operations' own uniqueness/state
 * invariants, producing two *different* HTTP responses (e.g. 201 for one, 409/400
 * for the other) for what the client believes is a single retried request —
 * defeating the purpose of the Idempotency-Key contract.
 */
export async function withIdempotency(
  route: string,
  key: string | undefined,
  requestBody: unknown,
  handler: () => Promise<CachedResponse>,
): Promise<CachedResponse> {
  if (!key) {
    return handler();
  }

  const requestHash = canonicalHash(requestBody);

  const lockClient = await pool.connect();
  try {
    await lockClient.query('SELECT pg_advisory_lock(hashtext($1))', [key]);
    try {
      const { rows } = await lockClient.query(
        'SELECT request_hash_sha256, response_status, response_body FROM loop_idempotency_keys WHERE key = $1 AND route = $2',
        [key, route],
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

      const result = await handler();

      await lockClient.query(
        `INSERT INTO loop_idempotency_keys (key, route, request_hash_sha256, response_status, response_body)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (key) DO NOTHING`,
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
