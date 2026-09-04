import IORedis from 'ioredis';
import { config } from '../src/config';
import { runMigrations } from '../src/db/migrate';

/**
 * Probe the database once at module load (Bun test files support top-level
 * await) so DB-backed cases can be declared with `it.skipIf(!dbReady)` and
 * show up as *skipped* in the run summary. The previous
 * `if (!dbReady) return;` pattern reported them as passed, which made a run
 * against an unreachable database look green.
 */
export async function probeDatabase(label: string): Promise<boolean> {
  try {
    await runMigrations();
    return true;
  } catch (error) {
    console.warn(`[${label}] Postgres unavailable — DB-backed tests are skipped:`, (error as Error).message);
    return false;
  }
}

/** Same idea for Redis-backed cases. */
export async function probeRedis(label: string): Promise<boolean> {
  const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: 1, enableReadyCheck: false, lazyConnect: true, connectTimeout: 2000 });
  redis.on('error', () => {});
  try {
    await redis.connect();
    await redis.ping();
    return true;
  } catch (error) {
    console.warn(`[${label}] Redis unavailable — Redis-backed tests are skipped:`, (error as Error).message);
    return false;
  } finally {
    redis.disconnect();
  }
}
