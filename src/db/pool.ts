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
 * Run `fn` inside a single transaction on a dedicated client.
 * Commits on success, rolls back on any throw, and always releases the client.
 * Mirrors the BEGIN/COMMIT/ROLLBACK pattern used by the migration runner.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
