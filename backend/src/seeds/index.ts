import bcrypt from 'bcryptjs';
import { connectDB, closeDB } from '../config/db';
import { closeRedis } from '../config/redis';
import { AdminUser } from '../models/admin_user';
import env, { isProd } from '../config/env';
import Logger from '../utils/logger';

/**
 * Bootstrap: ensure a superadmin exists (from ADMIN_EMAIL / ADMIN_PASSWORD) so the
 * admin panel can be logged into. That's the ONLY thing seeded — everything else
 * (products, API keys, workflows, templates) is created by admins in the UI. Idempotent.
 */
async function main() {
    await connectDB();

    const email = env.ADMIN_EMAIL.toLowerCase();
    const [admin, created] = await AdminUser.findOrCreate({
        where: { email },
        defaults: { email, name: 'Super Admin', password_hash: await bcrypt.hash(env.ADMIN_PASSWORD, 10) },
    });
    if (!created && !admin.password_hash) {
        await admin.update({ password_hash: await bcrypt.hash(env.ADMIN_PASSWORD, 10) });
    }

    Logger.info(created ? 'Bootstrapped superadmin' : 'Superadmin already exists', { email });
    if (!isProd) {
        console.log(`\n  superadmin  →  ${env.ADMIN_EMAIL} / ${env.ADMIN_PASSWORD}\n`);
    }

    await closeDB();
    await closeRedis().catch(() => undefined);
    process.exit(0);
}

main().catch((err) => {
    Logger.error('bootstrap failed', { message: err instanceof Error ? err.message : String(err) });
    process.exit(1);
});
