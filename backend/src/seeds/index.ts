import { connectDB, closeDB } from '../config/db';
import { closeRedis } from '../config/redis';
import bcrypt from 'bcryptjs';
import { Product } from '../models/product';
import { ApiKey } from '../models/api_key';
import { Workflow } from '../models/workflow';
import { WorkflowVersion } from '../models/workflow_version';
import { Template } from '../models/template';
import { AdminUser } from '../models/admin_user';
import { hashApiKey } from '../utils/crypto';
import { seedCreativeStudio } from './creative-studio';
import env, { isProd } from '../config/env';
import Logger from '../utils/logger';

const DEFAULT_LAYOUT = `<!doctype html><html><body style="margin:0;background:#f5f6f8;">
<div style="max-width:600px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  {% if logo_url %}<img src="{{ logo_url }}" alt="{{ brand_name }}" height="32" style="margin-bottom:16px;"/>{% endif %}
  {{ content }}
</div></body></html>`;

/** Ensure a product exists (by slug) and return it. */
async function ensureProduct(attrs: {
    slug: string;
    name: string;
    brand_name: string;
    brand_color: string;
    from_email: string;
    reply_to_email?: string;
    layout_html?: string;
}): Promise<Product> {
    const [product] = await Product.findOrCreate({
        where: { slug: attrs.slug },
        defaults: { ...attrs, layout_html: attrs.layout_html ?? DEFAULT_LAYOUT },
    });
    return product;
}

/** Ensure a (dev) API key exists for a product. Dev keys are deterministic so tests can reuse them. */
async function ensureDevApiKey(product: Product, plaintext: string, name: string): Promise<void> {
    const key_hash = hashApiKey(plaintext);
    await ApiKey.findOrCreate({
        where: { key_hash },
        defaults: { product_id: product.id, name, key_hash },
    });
}

async function main() {
    await connectDB();

    // ---- Default superadmin ----
    const [admin, adminCreated] = await AdminUser.findOrCreate({
        where: { email: env.ADMIN_EMAIL.toLowerCase() },
        defaults: {
            email: env.ADMIN_EMAIL.toLowerCase(),
            name: 'Super Admin',
            password_hash: await bcrypt.hash(env.ADMIN_PASSWORD, 10),
        },
    });
    if (!adminCreated && !admin.password_hash) {
        await admin.update({ password_hash: await bcrypt.hash(env.ADMIN_PASSWORD, 10) });
    }

    // ---- Demo product (Phase 1 pipeline verification) ----
    const demo = await ensureProduct({
        slug: 'demo',
        name: 'Demo Product',
        brand_name: 'SalesDuo Demo',
        brand_color: '#ff9900',
        from_email: 'SalesDuo Demo <demo@salesduo.com>',
        reply_to_email: 'support@salesduo.com',
    });
    const DEMO_KEY = 'sdm_demo_dev_key_do_not_use_in_prod';
    await ensureDevApiKey(demo, DEMO_KEY, 'demo dev key');

    // Short-delay demo workflow — for fast schedule-and-cancel verification.
    const [demoWf] = await Workflow.findOrCreate({
        where: { product_id: demo.id, key: 'demo_nudge' },
        defaults: {
            product_id: demo.id,
            key: 'demo_nudge',
            name: 'Demo nudge (3s delay)',
            trigger_event_key: 'demo.start',
            category: 'onboarding',
            audience: 'event_subscriber',
        },
    });
    if (!demoWf.active_version_id) {
        const v = await WorkflowVersion.create({
            workflow_id: demoWf.id,
            version: 1,
            steps: [
                { type: 'delay', duration: '3s' },
                { type: 'cancel_on', event_keys: ['demo.done'] },
                { type: 'send', channel: 'email', template: 'demo_nudge' },
            ],
        });
        await demoWf.update({ active_version_id: v.id });
    }
    await Template.findOrCreate({
        where: { product_id: demo.id, key: 'demo_nudge' },
        defaults: {
            product_id: demo.id,
            key: 'demo_nudge',
            type: 'marketing',
            workflow_id: demoWf.id,
            channel: 'email',
            subject: 'Demo nudge for {{ first_name }}',
            body: '<p>Hi {{ first_name }}, this delayed nudge fired after the delay elapsed.</p>',
            cta: null,
            variables: [],
        },
    });
    await Template.findOrCreate({
        where: { product_id: demo.id, key: 'demo_otp' },
        defaults: {
            product_id: demo.id,
            key: 'demo_otp',
            type: 'transactional',
            workflow_id: null,
            channel: 'email',
            subject: 'Your demo login code',
            body: '<p>Hi {{ first_name }}, your code is <strong>{{ otp }}</strong> (expires in {{ expires_minutes }} min).</p>',
            variables: ['otp', 'expires_minutes'],
        },
    });

    Logger.info('Seed complete.');
    console.log('\n=== Seeded admin / products / dev API keys ===');
    // Never print the admin password outside development.
    const cred = isProd ? '(ADMIN_PASSWORD as configured)' : env.ADMIN_PASSWORD;
    console.log(`  superadmin  →  ${env.ADMIN_EMAIL} / ${cred}`);
    console.log(`  demo  →  ${DEMO_KEY}`);

    await seedCreativeStudio();

    await closeDB();
    await closeRedis().catch(() => undefined);
    process.exit(0);
}

main().catch((err) => {
    Logger.error('seed failed', { message: err instanceof Error ? err.message : String(err) });
    process.exit(1);
});
