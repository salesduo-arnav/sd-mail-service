import { Worker } from 'bullmq';
import { bullConnectionOpts } from '../config/redis';
import { QUEUE_DELAYED, DelayedJobData } from './index';
import { fireRunStep } from '../services/engine/fire-step';
import Logger from '../utils/logger';

/** Start the worker that fires delayed sends when their scheduled time arrives. */
export function startDelayedWorker(): Worker {
    const worker = new Worker<DelayedJobData>(
        QUEUE_DELAYED,
        async (job) => {
            await fireRunStep(job.data.runStepId);
        },
        { connection: bullConnectionOpts(), concurrency: 10 },
    );

    worker.on('failed', (job, err) => {
        Logger.error('delayed job failed', { jobId: job?.id, attempts: job?.attemptsMade, message: err.message });
    });

    Logger.info('delayed worker started');
    return worker;
}
