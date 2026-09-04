import { Pool, type PoolClient } from 'pg';
import { config } from '../config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolSize,
  idleTimeoutMillis: config.dbIdleTimeoutMs,
  connectionTimeoutMillis: config.dbConnectionTimeoutMs,
  ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
});

pool.on('error', (err: Error) => {
  console.error('Postgres pool error', err);
});

/**
 * Minimal structural type satisfied by both `pool` and a checked-out `PoolClient`,
 * so query helpers can run either against the pool directly or inside a transaction.
 */
export interface Queryable {
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
}

/**
 * Run `fn` inside a single transaction.
 * Commits on success, rolls back on any throw. When `existing` is omitted a
 * client is checked out from the pool and always released afterwards; when a
 * caller already holds a client (e.g. `withIdempotency`, which keeps one for
 * its advisory lock) that client is reused so a single request never needs two
 * pool slots — with `DB_POOL_SIZE` concurrent keyed writes, holding one slot
 * per request while waiting for a second would exhaust the pool.
 * Mirrors the BEGIN/COMMIT/ROLLBACK pattern used by the migration runner.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  existing?: PoolClient,
): Promise<T> {
  const client = existing ?? await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (!existing) {
      client.release();
    }
  }
}
