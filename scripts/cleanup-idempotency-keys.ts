import { pool } from '../src/db/pool';
import { IDEMPOTENCY_RETENTION_MS } from '../src/idempotency';

async function main() {
  const cutoff = new Date(Date.now() - IDEMPOTENCY_RETENTION_MS);
  const { rowCount } = await pool.query('DELETE FROM loop_idempotency_keys WHERE created_at < $1', [cutoff]);
  console.log(`Deleted ${rowCount} idempotency key(s) older than ${cutoff.toISOString()}`);
}

main()
  .catch((error) => {
    console.error('Idempotency key cleanup failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
