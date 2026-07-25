import type { FastifyInstance } from 'fastify';
import IORedis from 'ioredis';
import { config } from '../config';
import { pool } from '../db/pool';

export type RedisHealth = 'ok' | 'error' | 'skipped';

export type HealthDeps = {
  checkDb: () => Promise<'ok' | 'error'>;
  checkRedis: () => Promise<RedisHealth>;
};

export async function defaultCheckDb(): Promise<'ok' | 'error'> {
  try {
    await pool.query('SELECT 1');
    return 'ok';
  } catch {
    return 'error';
  }
}

/**
 * Probe Redis with a short-lived client so the health handler does not share
 * the BullMQ connection (or leave a long-lived socket open per request).
 */
export async function defaultCheckRedis(): Promise<RedisHealth> {
  if (!config.redisUrl) {
    return 'skipped';
  }

  const client = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  try {
    await client.connect();
    const pong = await client.ping();
    return pong === 'PONG' ? 'ok' : 'error';
  } catch {
    return 'error';
  } finally {
    client.disconnect();
  }
}

const defaultDeps: HealthDeps = {
  checkDb: defaultCheckDb,
  checkRedis: defaultCheckRedis,
};

const healthResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    time: { type: 'string' },
    uptime: { type: 'number' },
    db: { type: 'string' },
    redis: { type: 'string' },
  },
};

export async function registerHealthRoutes(
  app: FastifyInstance,
  deps: HealthDeps = defaultDeps,
) {
  app.get('/health', {
    schema: {
      response: {
        200: healthResponseSchema,
        503: healthResponseSchema,
      },
    },
  }, async (_request, reply) => {
    const [dbStatus, redisStatus] = await Promise.all([
      deps.checkDb(),
      deps.checkRedis(),
    ]);

    const healthy =
      dbStatus === 'ok' && (redisStatus === 'ok' || redisStatus === 'skipped');

    const payload = {
      status: healthy ? 'ok' : 'degraded',
      time: new Date().toISOString(),
      uptime: process.uptime(),
      db: dbStatus,
      redis: redisStatus,
    };

    if (!healthy) {
      reply.code(503);
    }
    return payload;
  });
}
