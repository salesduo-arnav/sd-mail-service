import { Queue, JobsOptions } from 'bullmq';
import { bullConnectionOpts } from '../config/redis';

export const QUEUE_EVENT = 'sdmail_events';
export const QUEUE_DELIVERY = 'sdmail_delivery'; // Phase 2
export const QUEUE_DELAYED = 'sdmail_delayed'; // Phase 2
export const QUEUE_MAINTENANCE = 'sdmail_maintenance'; // Phase 2 (nightly sweep)

const defaultJobOptions: JobsOptions = {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
};

let eventQueue: Queue | null = null;
let delayedQueue: Queue | null = null;
let maintenanceQueue: Queue | null = null;

export function getEventQueue(): Queue {
    if (!eventQueue) {
        eventQueue = new Queue(QUEUE_EVENT, { connection: bullConnectionOpts(), defaultJobOptions });
    }
    return eventQueue;
}

export function getDelayedQueue(): Queue {
    if (!delayedQueue) {
        delayedQueue = new Queue(QUEUE_DELAYED, { connection: bullConnectionOpts(), defaultJobOptions });
    }
    return delayedQueue;
}

export interface EventJobData {
    eventLogId: string;
}
export interface DelayedJobData {
    runStepId: string;
}

/** Enqueue an ingested event for async workflow processing. */
export async function enqueueEvent(eventLogId: string): Promise<void> {
    await getEventQueue().add('process', { eventLogId } as EventJobData, {
        jobId: eventLogId, // idempotent enqueue: one job per event_log row
    });
}

/** Schedule a delayed send to fire in `delayMs`. jobId = run_step id (cancelable). */
export async function enqueueDelayedSend(runStepId: string, delayMs: number): Promise<void> {
    await getDelayedQueue().add('send', { runStepId } as DelayedJobData, { jobId: runStepId, delay: delayMs });
}

/** Best-effort removal of a scheduled delayed job (used on cancellation). */
export async function removeDelayedJob(jobId: string): Promise<void> {
    const job = await getDelayedQueue().getJob(jobId);
    if (job) await job.remove().catch(() => undefined);
}

export function getMaintenanceQueue(): Queue {
    if (!maintenanceQueue) {
        maintenanceQueue = new Queue(QUEUE_MAINTENANCE, { connection: bullConnectionOpts(), defaultJobOptions });
    }
    return maintenanceQueue;
}

/** Register the nightly inactivity sweep as a repeatable job (idempotent by key). */
export async function scheduleNightlySweep(cron = '0 3 * * *'): Promise<void> {
    await getMaintenanceQueue().add('nightly-sweep', {}, { repeat: { pattern: cron }, jobId: 'nightly-sweep' });
}

export async function closeQueues(): Promise<void> {
    if (eventQueue) await eventQueue.close();
    if (delayedQueue) await delayedQueue.close();
    if (maintenanceQueue) await maintenanceQueue.close();
}
