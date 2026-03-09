import { Pool } from 'pg';
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
