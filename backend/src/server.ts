import { createApp } from './app';
import env from './config/env';
import { connectDB, closeDB } from './config/db';
import { closeRedis } from './config/redis';
import Logger from './utils/logger';

async function main() {
    await connectDB();

    const app = createApp();
    const server = app.listen(env.PORT, () => {
        Logger.info(`api listening on :${env.PORT} (${env.NODE_ENV})`);
    });

    const shutdown = async (signal: string) => {
        Logger.info(`${signal} received — shutting down api`);
        // Force-exit if graceful close hangs on a stuck connection.
        setTimeout(() => process.exit(1), 10_000).unref();
        server.close(async () => {
            await closeDB().catch(() => undefined);
            await closeRedis().catch(() => undefined);
            process.exit(0);
        });
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
    Logger.error('api failed to start', { message: err instanceof Error ? err.message : String(err) });
    process.exit(1);
});
