import { Worker } from 'bullmq';
import { bullConnectionOpts } from '../config/redis';
import { QUEUE_EVENT, EventJobData } from './index';
import { processEvent } from '../services/engine/process-event';
import Logger from '../utils/logger';

/** Start the BullMQ worker that processes ingested events. */
export function startEventWorker(): Worker {
    const worker = new Worker<EventJobData>(
        QUEUE_EVENT,
        async (job) => {
            await processEvent(job.data.eventLogId);
        },
        { connection: bullConnectionOpts(), concurrency: 10 },
    );

    worker.on('failed', (job, err) => {
        Logger.error('event job failed', { jobId: job?.id, attempts: job?.attemptsMade, message: err.message });
    });
    worker.on('completed', (job) => Logger.debug('event job completed', { jobId: job.id }));

    Logger.info('event worker started');
    return worker;
}
