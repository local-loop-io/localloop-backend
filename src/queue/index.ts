import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { insertInterestEvent } from '../db/interestEvents';
import { incrementMetric } from '../metrics';

let connection: IORedis | null = null;
let queue: Queue | null = null;

export const getConnection = () => {
  if (!connection) {
    connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    // Without a listener, an unhandled 'error' event on this EventEmitter
    // crashes the whole process (mirrors src/db/pool.ts's pool.on('error', ...)).
    // This connection backs enqueueInterest, which runs on every POST
    // /api/interest regardless of WORKER_ENABLED, so a transient Redis blip
    // must not be able to take down the API.
    connection.on('error', (err: Error) => {
      console.error('Redis connection error', err);
    });
  }
  return connection;
};

const getQueue = () => {
  if (!queue) {
    queue = new Queue('interest', { connection: getConnection() as never });
  }
  return queue;
};

export function enqueueInterest(payload: unknown): Promise<unknown> {
  return getQueue().add('interest:created', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
}

type InterestJobPayload = {
  id?: number;
  created_at?: string;
};

type QueueDeps = {
  insertInterestEvent: typeof insertInterestEvent;
};

const defaultDeps: QueueDeps = {
  insertInterestEvent,
};

export function createInterestJobHandler(deps: QueueDeps = defaultDeps) {
  return async (job: { name: string; data: InterestJobPayload }) => {
    if (job.name !== 'interest:created') {
      return { status: 'ignored' };
    }

    const interestId = Number(job.data?.id);
    if (!Number.isFinite(interestId)) {
      return { status: 'invalid' };
    }

    await deps.insertInterestEvent({
      interestId,
      eventType: 'created',
      payload: {
        id: interestId,
        created_at: job.data?.created_at,
      },
    });

    return { status: 'logged' };
  };
}

/**
 * Close the shared BullMQ queue and its Redis connection (shutdown path).
 * Safe to call when nothing was ever opened.
 */
export async function closeQueue() {
  const openQueue = queue;
  const openConnection = connection;
  queue = null;
  connection = null;
  if (openQueue) {
    await openQueue.close();
  }
  if (openConnection) {
    await openConnection.quit().catch(() => openConnection.disconnect());
  }
}

export function startWorkers() {
  if (!config.workerEnabled) {
    return null;
  }

  const worker = new Worker(
    'interest',
    createInterestJobHandler(),
    { connection: getConnection() as never }
  );

  worker.on('failed', (job, error) => {
    console.error('Queue job failed', job?.id, error);
    incrementMetric('queue_job_failed');
  });

  return worker;
}
