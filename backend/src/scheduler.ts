import { connectDB, closeDB } from './config/db';
import { closeRedis } from './config/redis';
import { closeQueues, scheduleNightlySweep } from './queues';
import { startMaintenanceWorker } from './queues/maintenance.worker';
import './models'; // register models + associations
import Logger from './utils/logger';

/**
 * Scheduler process — owns the nightly inactivity sweep (repeatable job), run
 * behind a Redis lock so multiple replicas are safe.
 */
async function main() {
    await connectDB();
    await scheduleNightlySweep();
    const worker = startMaintenanceWorker();
    Logger.info('scheduler started');

    const shutdown = async (signal: string) => {
        Logger.info(`${signal} received — shutting down scheduler`);
        setTimeout(() => process.exit(1), 15_000).unref();
        await worker.close().catch(() => undefined);
        await closeQueues().catch(() => undefined);
        await closeDB().catch(() => undefined);
        await closeRedis().catch(() => undefined);
        process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
    Logger.error('scheduler failed to start', { message: err instanceof Error ? err.message : String(err) });
    process.exit(1);
});
