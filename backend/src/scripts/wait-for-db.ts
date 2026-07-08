import sequelize, { closeDB } from '../config/db';
import Logger from '../utils/logger';

/** Poll Postgres until it accepts connections (so `dev` can migrate/seed safely). */
async function waitForDb(retries = 30, delayMs = 2000): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await sequelize.authenticate();
            Logger.info('database is ready');
            await closeDB().catch(() => undefined);
            process.exit(0);
        } catch {
            Logger.warn(`waiting for database (${attempt}/${retries})…`);
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    Logger.error('database not reachable — is it running? (try `make infra`)');
    process.exit(1);
}

void waitForDb();
