import { Prisma } from '@prisma/client';
import { Worker, Job } from 'bullmq';
import { connection } from './index';
import { routeJob } from './jobRouter';
import { prisma } from '../prisma';

function serializeOutput(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function startWorker() {
  const worker = new Worker(
    'execution-jobs',
    async (job: Job<any>) => {
      const executionJobId = job.data.executionJobId as string;

      // Mark as running
      await prisma.executionJob.update({
        where: { id: executionJobId },
        data: {
          status: 'running',
          startedAt: new Date(),
        },
      });

      try {
        const result = await routeJob(job.data);
        const output =
          result.output && typeof result.output === 'object'
            ? (result.output as Record<string, unknown>)
            : null;
        const outputStatus =
          typeof output?.status === 'string' ? output.status : null;

        if (outputStatus === 'queued_for_cowork') {
          await prisma.executionJob.update({
            where: { id: executionJobId },
            data: {
              status: 'queued',
              resultStatus: 'cowork_pending',
                outputSummary:
                  typeof output?.summary === 'string'
                  ? output.summary
                  : 'Queued cowork follow-up.',
                outputLog: serializeOutput(result.output),
                executionTier:
                  typeof output?.executionTier === 'number'
                  ? output.executionTier
                  : 3,
                ...(output?.coworkInstruction
                  ? {
                      coworkInstruction:
                        output.coworkInstruction as Prisma.InputJsonValue
                    }
                  : {}),
            },
          });

          return result;
        }

        if (!result.success) {
          await prisma.executionJob.update({
            where: { id: executionJobId },
            data: {
              status: 'failed',
              resultStatus: outputStatus ?? 'error',
              outputLog: serializeOutput(result.output),
              errorLog:
                typeof output?.error === 'string'
                  ? output.error
                  : 'Execution failed',
              completedAt: new Date(),
            },
          });

          return result;
        }

        await prisma.executionJob.update({
          where: { id: executionJobId },
          data: {
            status: result.dryRun ? 'dry_run_complete' : 'complete',
            resultStatus: outputStatus ?? 'success',
            outputLog: serializeOutput(result.output),
            completedAt: new Date(),
          },
        });

        return result;
      } catch (err: any) {
        await prisma.executionJob.update({
          where: { id: executionJobId },
          data: {
            status: 'failed',
            resultStatus: 'error',
            errorLog: err?.message ?? String(err),
            completedAt: new Date(),
          },
        });
        throw err; // rethrow so BullMQ handles retry
      }
    },
    {
      connection,
      concurrency: 3, // process up to 3 jobs at once
    }
  );

  worker.on('completed', (job: Job<any>) => {
    console.info(`[worker] job ${job.id} completed`);
  });

  worker.on('failed', (job: Job<any> | undefined, err: any) => {
    console.error(`[worker] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
