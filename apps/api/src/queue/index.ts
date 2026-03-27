import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
const isTest = process.env.NODE_ENV === 'test';
export const hasRedis = Boolean(redisUrl) && !isTest;

const noQueue = isTest || !hasRedis;

export const connection = noQueue
  ? (null as unknown as IORedis)
  : new IORedis(redisUrl!, {
      maxRetriesPerRequest: null, // required by BullMQ
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });

export const executionQueue = noQueue
  ? ({
      add: async () => {
        console.warn('[queue] REDIS_URL not set — job queuing is disabled');
        return null;
      },
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

export const queueEvents = noQueue
  ? (null as unknown as QueueEvents)
  : new QueueEvents('execution-jobs', { connection });
