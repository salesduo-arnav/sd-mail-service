import { connectDB, closeDB } from './config/db';
import { closeRedis } from './config/redis';
import { closeQueues } from './queues';
import { startEventWorker } from './queues/event.worker';
import { startDelayedWorker } from './queues/delayed.worker';
import { startCampaignWorker } from './queues/campaign.worker';
import './models'; // register models + associations
import Logger from './utils/logger';

/**
 * Worker process — consumes BullMQ queues (event processing + delayed sends).
 */
async function main() {
    await connectDB();

    const workers: Array<{ close: () => Promise<void> }> = [
        startEventWorker(),
        startDelayedWorker(),
        startCampaignWorker(),
    ];
    Logger.info('worker started');

    const shutdown = async (signal: string) => {
        Logger.info(`${signal} received — shutting down worker`);
        setTimeout(() => process.exit(1), 5000).unref();
        await Promise.all(workers.map((w) => w.close().catch(() => undefined)));
        await closeQueues().catch(() => undefined);
        await closeDB().catch(() => undefined);
        await closeRedis().catch(() => undefined);
        process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
    Logger.error('worker failed to start', { message: err instanceof Error ? err.message : String(err) });
    process.exit(1);
});
