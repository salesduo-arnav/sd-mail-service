import { Worker } from 'bullmq';
import { bullConnectionOpts } from '../config/redis';
import redis from '../config/redis';
import { QUEUE_MAINTENANCE } from './index';
import { runInactivitySweep } from '../services/sweep.service';
import Logger from '../utils/logger';

/**
 * Runs the nightly sweep. A Redis lock (SET NX EX) guarantees a single execution
 * even if multiple scheduler replicas process the repeatable job.
 */
export function startMaintenanceWorker(): Worker {
    const worker = new Worker(
        QUEUE_MAINTENANCE,
        async () => {
            const ok = await redis.set('sdmail:lock:nightly-sweep', '1', 'EX', 3600, 'NX');
            if (!ok) {
                Logger.info('nightly sweep already running elsewhere — skipping');
                return;
            }
            try {
                await runInactivitySweep();
            } finally {
                await redis.del('sdmail:lock:nightly-sweep').catch(() => undefined);
            }
        },
        { connection: bullConnectionOpts(), concurrency: 1 },
    );

    worker.on('failed', (job, err) =>
        Logger.error('maintenance job failed', { jobId: job?.id, message: err.message }),
    );
    Logger.info('maintenance worker started');
    return worker;
}
