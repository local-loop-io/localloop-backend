import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Session-level advisory lock held for the whole migration run so two processes
 * starting at once (an `api` container with RUN_MIGRATIONS=true racing a manual
 * `bun run migrate`, or two replicas) cannot both apply the same file. The
 * second runner blocks until the first finishes, then re-reads
 * `schema_migrations` and finds nothing left to do. Arbitrary constant; the
 * bytes spell "loop".
 */
const MIGRATION_LOCK_KEY = 0x6c6f6f70;

/**
 * Migrations are plain `.sql` files in ./migrations applied in filename order
 * and recorded by filename in `schema_migrations`. The runner does not checksum
 * file contents, so already-applied files may be edited (e.g. to make a statement
 * re-runnable) without re-triggering them. Keep numeric prefixes unique — the
 * duplicate `004_` pair predates this rule and is kept only because renaming an
 * applied file would re-run it.
 */
export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      const { rows } = await client.query('SELECT version FROM schema_migrations');
      const applied = new Set(rows.map((row) => row.version));

      const migrationsDir = path.join(__dirname, 'migrations');
      const files = (await fs.readdir(migrationsDir))
        .filter((file) => file.endsWith('.sql'))
        .sort();

      for (const file of files) {
        if (applied.has(file)) {
          continue;
        }
        const sqlPath = path.join(migrationsDir, file);
        const sql = await fs.readFile(sqlPath, 'utf8');

        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`Applied migration ${file}`);
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`Migration ${file} failed`, error);
          throw error;
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

if (import.meta.main) {
  runMigrations()
    .catch((error) => {
      console.error('Migration failed', error);
      process.exit(1);
    })
    .finally(async () => {
      await pool.end();
    });
}
