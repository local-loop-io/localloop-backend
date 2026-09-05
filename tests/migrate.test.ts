import { describe, expect, it } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../src/db/pool';
import { runMigrations } from '../src/db/migrate';
import { probeDatabase } from './dbReady';

const dbReady = await probeDatabase('migrate');

describe('migration runner', () => {
  it.skipIf(!dbReady)('serializes concurrent runners and records every file exactly once', async () => {
    // Two runners at once (an api container with RUN_MIGRATIONS=true racing a
    // manual `bun run migrate`) must not both apply the same file: the advisory
    // lock makes the second wait, then find nothing left to do.
    await Promise.all([runMigrations(), runMigrations()]);

    const files = readdirSync(join(import.meta.dir, '..', 'src', 'db', 'migrations')).filter((f) => f.endsWith('.sql'));
    // Compare as sets sorted in JS: the database collation orders '004b_' and
    // '004_' differently from byte order.
    const { rows } = await pool.query('SELECT version FROM schema_migrations');
    expect(rows.map((row) => row.version as string).sort()).toEqual([...files].sort());
  });

  it.skipIf(!dbReady)('scopes idempotency cache rows to (key, route) after migration 018', async () => {
    const { rows } = await pool.query(`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = 'loop_idempotency_keys'::regclass AND i.indisprimary
      ORDER BY a.attname`);
    expect(rows.map((row) => row.attname)).toEqual(['key', 'route']);
  });

  it.skipIf(!dbReady)('re-running an already-applied constraint migration does not fail', async () => {
    // 011 and 016 ADD/DROP constraints; they are written to be re-runnable so a
    // restored database with a lost schema_migrations table can be brought back.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('ALTER TABLE loop_offers DROP CONSTRAINT IF EXISTS chk_loop_offers_status');
      await client.query("ALTER TABLE loop_offers ADD CONSTRAINT chk_loop_offers_status CHECK (status IN ('open', 'reserved', 'withdrawn'))");
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    expect(true).toBe(true);
  });
});
