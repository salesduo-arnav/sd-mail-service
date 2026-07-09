import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load backend/.env (mirrors core-platform's config loading)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Single source of truth for configuration. Validates process.env at boot and
 * fails fast with a clear message if anything required is missing/malformed.
 * Import `env` everywhere instead of reading process.env directly.
 */
const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.string().optional(),
    PUBLIC_URL: z.string().url().default('http://localhost:3000'),
    // Comma-separated allowlist of browser origins for CORS (prod). Dev reflects any.
    CORS_ORIGINS: z.string().optional(),
    // Serve the built admin SPA from the api (single-container). Auto-on in production.
    // (z.coerce.boolean treats "false" as true, so parse explicitly.)
    SERVE_ADMIN: z
        .enum(['true', 'false', '1', '0', ''])
        .default('false')
        .transform((v) => v === 'true' || v === '1'),

    // Postgres
    PGHOST: z.string().default('localhost'),
    PGPORT: z.coerce.number().int().positive().default(5432),
    PGUSER: z.string().default('postgres'),
    PGPASSWORD: z.string().default('postgres'),
    PGDATABASE: z.string().default('sd_mail'),
    DB_SSL_CA: z.string().optional(),

    // Redis
    REDIS_URL: z.string().default('redis://localhost:6379'),
    REDIS_PASSWORD: z.string().optional(),

    // Email
    EMAIL_TRANSPORT: z.enum(['smtp', 'ses']).default('smtp'),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default('"SalesDuo" <no-reply@salesduo.com>'),
    SES_REGION: z.string().default('us-east-1'),
    // Optional allowlist: only accept SNS feedback from this topic ARN (recommended in prod).
    SES_SNS_TOPIC_ARN: z.string().optional(),

    // Default superadmin (seeded). Change in production.
    ADMIN_EMAIL: z.string().email().default('admin@salesduo.com'),
    ADMIN_PASSWORD: z.string().default('admin12345'),

    // Secrets — dev defaults, enforced non-default in production below
    ADMIN_SESSION_SECRET: z.string().default('dev-admin-session-secret-change-me'),
    HMAC_SECRET: z.string().default('dev-hmac-secret-change-me'),
    UNSUB_SECRET: z.string().default('dev-unsubscribe-secret-change-me'),
    INTERNAL_API_KEY: z.string().default('dev-internal-api-key-change-me'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
}

const env = parsed.data;

// Extra production guards: required secrets must not be left at dev defaults.
if (isProduction) {
    const mustSet: Array<keyof typeof env> = [
        'ADMIN_SESSION_SECRET',
        'HMAC_SECRET',
        'UNSUB_SECRET',
        'INTERNAL_API_KEY',
    ];
    const bad = mustSet.filter((k) => String(env[k]).startsWith('dev-'));
    if (bad.length) {
        console.error(`Refusing to boot in production with default secrets: ${bad.join(', ')}`);
        process.exit(1);
    }
    // The seeded superadmin must not ship with the dev default password.
    if (env.ADMIN_PASSWORD === 'admin12345') {
        console.error('Refusing to boot in production with the default ADMIN_PASSWORD — set a strong value.');
        process.exit(1);
    }
    if (env.EMAIL_TRANSPORT === 'smtp' && (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS)) {
        console.error('SMTP_HOST, SMTP_USER, SMTP_PASS are required in production when EMAIL_TRANSPORT=smtp.');
        process.exit(1);
    }
}

export const isProd = isProduction;
export const isTest = env.NODE_ENV === 'test';
export default env;
