import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';

let connection: IORedis | null = null;
let queue: Queue | null = null;

const getConnection = () => {
  if (!connection) {
    connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
};

const getQueue = () => {
  if (!queue) {
    queue = new Queue('interest', { connection: getConnection() });
  }
  return queue;
};

export function enqueueInterest(payload: unknown) {
  if (!config.redisUrl) {
    return Promise.resolve();
  }

  return getQueue().add('interest:created', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
}

export function startWorkers() {
  if (!config.workerEnabled) {
    return null;
  }

  const worker = new Worker(
    'interest',
    async (job) => {
      if (job.name === 'interest:created') {
        // Placeholder for notifications, emails, or analytics hooks.
        return { status: 'queued' };
      }
      return { status: 'ignored' };
    },
    { connection: getConnection() }
  );

  worker.on('failed', (job, error) => {
    console.error('Queue job failed', job?.id, error);
  });

  return worker;
}
