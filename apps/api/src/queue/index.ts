import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const isTest = process.env.NODE_ENV === 'test';

export const connection = isTest
  ? (null as unknown as IORedis)
  : new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // required by BullMQ
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });

export const executionQueue = isTest
  ? ({
      add: async () => null,
    } as unknown as Queue)
  : new Queue('execution-jobs', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    });

export const queueEvents = isTest
  ? (null as unknown as QueueEvents)
  : new QueueEvents('execution-jobs', { connection });
