import { describe, expect, it } from 'bun:test';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createInterestJobHandler, getConnection } from '../src/queue';
import { getMetricsSnapshot, incrementMetric } from '../src/metrics';
import { config } from '../src/config';
import { probeRedis } from './dbReady';

const redisReady = await probeRedis('queue');

describe('queue handlers', () => {
  it('ignores unrelated jobs', async () => {
    const handler = createInterestJobHandler({
      insertInterestEvent: async () => ({ id: 1, created_at: new Date().toISOString() }),
    });

    const result = await handler({ name: 'other', data: {} });
    expect(result.status).toBe('ignored');
  });

  it('flags invalid interest payloads', async () => {
    const handler = createInterestJobHandler({
      insertInterestEvent: async () => ({ id: 1, created_at: new Date().toISOString() }),
    });

    const result = await handler({ name: 'interest:created', data: {} });
    expect(result.status).toBe('invalid');
  });

  it('logs interest events', async () => {
    const calls: Array<{ interestId: number; eventType: string }> = [];
    const handler = createInterestJobHandler({
      insertInterestEvent: async (input) => {
        calls.push({ interestId: input.interestId, eventType: input.eventType });
        return { id: 1, created_at: new Date().toISOString() };
      },
    });

    const result = await handler({
      name: 'interest:created',
      data: { id: 42, created_at: '2025-01-01T00:00:00Z' },
    });

    expect(result.status).toBe('logged');
    expect(calls[0].interestId).toBe(42);
    expect(calls[0].eventType).toBe('created');
  });

  it('does not crash the process when the Redis connection emits an error', () => {
    // Node throws an unhandled 'error' event synchronously when an
    // EventEmitter has zero listeners for it. getConnection() must register
    // one so a transient Redis blip can't take the whole API process down.
    const connection = getConnection();
    let thrown: unknown;
    try {
      connection.emit('error', new Error('synthetic redis error'));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeUndefined();
    connection.disconnect();
  });

  it.skipIf(!redisReady)('increments the queue_job_failed metric when a job fails (mirrors startWorkers\' failed handler)', async () => {
    // Deliberately independent of getConnection()'s shared singleton (the
    // preceding test disconnects it) so this test doesn't depend on suite
    // ordering.
    const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: true });
    redis.on('error', () => {});
    await redis.connect();

    const queueName = `test-queue-job-failed-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const queue = new Queue(queueName, { connection: redis as never });
    const worker = new Worker(
      queueName,
      async () => {
        throw new Error('intentional test failure');
      },
      { connection: redis as never },
    );
    // Same shape as the handler registered in startWorkers() — this proves
    // the increment actually fires when BullMQ reports a job failure.
    worker.on('failed', () => {
      incrementMetric('queue_job_failed');
    });

    try {
      const before = getMetricsSnapshot().metrics.queue_job_failed;

      await queue.add('will-fail', {}, { attempts: 1 });
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('timed out waiting for job to fail')), 10000);
        worker.on('failed', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      const after = getMetricsSnapshot().metrics.queue_job_failed;
      expect(after).toBe(before + 1);
    } finally {
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
      redis.disconnect();
    }
  }, 15000);
});
