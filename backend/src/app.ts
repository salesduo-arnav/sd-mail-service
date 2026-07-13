import fs from 'fs';
import path from 'path';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import sequelize from './config/db';
import redis from './config/redis';
import env, { isProd } from './config/env';
import { errorHandler, notFound } from './utils/errors';
import Logger from './utils/logger';
import './models'; // register models + associations
import publicRoutes from './routes/public.routes';
import webhookRoutes from './routes/webhook.routes';
import { postSesFeedback } from './controllers/webhooks.controller';
import adminRoutes from './routes/admin.routes';
import internalRoutes from './routes/internal.routes';
import { openapiSpec } from './openapi/spec';

export function createApp() {
    const app = express();

    app.set('trust proxy', 1);
    app.use(helmet());

    // CORS: dev reflects any origin (Vite/local); prod restricts to an allowlist
    // (CORS_ORIGINS). Requests with no Origin (server-to-server, curl) always pass.
    const allowed = (env.CORS_ORIGINS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    app.use(
        cors({
            credentials: true,
            origin: (origin, cb) => {
                if (!origin || !isProd || allowed.includes(origin)) return cb(null, true);
                cb(new Error('Not allowed by CORS'));
            },
        }),
    );
    app.use(cookieParser());

    // SNS/SES feedback authenticates by signature over a raw text body, so it's mounted
    // before express.json() (which would otherwise consume and re-encode the body).
    app.post('/webhooks/ses', express.text({ type: '*/*', limit: '256kb' }), postSesFeedback);

    app.use(express.json({ limit: '256kb' }));
    app.use(morgan('tiny', { stream: { write: (m) => Logger.http(m.trim()) }, skip: (req) => req.path === '/health' }));

    // Rate limits (per-IP, in-memory per instance — for multi-instance, back with a
    // shared store). Ingest is high-volume; admin login is brute-force sensitive.
    app.use('/internal', rateLimit({ windowMs: 60_000, max: 600, standardHeaders: true, legacyHeaders: false }));
    app.use(
        '/admin/auth/login',
        rateLimit({
            windowMs: 15 * 60_000,
            max: 20,
            standardHeaders: true,
            legacyHeaders: false,
            message: { error: 'rate_limited', message: 'Too many login attempts. Try again later.' },
        }),
    );
    app.use('/admin', rateLimit({ windowMs: 60_000, max: 600, standardHeaders: true, legacyHeaders: false }));

    // Liveness/readiness — checks DB + Redis.
    app.get('/health', async (_req: Request, res: Response) => {
        const health: Record<string, string> = { status: 'ok' };
        try {
            await sequelize.authenticate();
            health.db = 'up';
        } catch {
            health.db = 'down';
            health.status = 'degraded';
        }
        try {
            await redis.ping();
            health.redis = 'up';
        } catch {
            health.redis = 'down';
            health.status = 'degraded';
        }
        res.status(health.status === 'ok' ? 200 : 503).json(health);
    });

    // ---- API routes ----
    app.use('/', publicRoutes); // GET /u/:token (unsubscribe)
    app.use('/webhooks', webhookRoutes); // provider bounce/complaint feedback
    app.use('/admin', adminRoutes); // superadmin control plane
    app.use('/internal', internalRoutes); // forward-compat /internal/email/send
    app.get('/openapi.json', (_req, res) => res.json(openapiSpec));

    // Rendered API docs (Redoc) at /docs. A route-scoped CSP allows the Redoc bundle.
    app.get('/docs', (_req, res) => {
        res.setHeader(
            'Content-Security-Policy',
            [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' https://cdn.redocly.com",
                "worker-src blob:",
                "child-src blob:",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' data: https://fonts.gstatic.com",
                "img-src 'self' data: https://cdn.redocly.com",
                "connect-src 'self'",
            ].join('; '),
        );
        res.type('html').send(
            `<!doctype html><html><head><meta charset="utf-8"/>
<title>sd-mail-service — API docs</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>body{margin:0}</style></head>
<body>
<redoc spec-url="/openapi.json"></redoc>
<script src="https://cdn.redocly.com/redoc/latest/bundles/redoc.standalone.js"></script>
</body></html>`,
        );
    });

    // Serve the built admin SPA ONLY for a single-container/production deploy
    // (production, or opt-in via SERVE_ADMIN=true). In dev the admin runs on its
    // own Vite server (:5180), so the api at :3110 stays API-only — no double-serve.
    const adminDist = path.resolve(__dirname, '../../admin/dist');
    if ((isProd || env.SERVE_ADMIN) && fs.existsSync(path.join(adminDist, 'index.html'))) {
        app.use(express.static(adminDist));
        // SPA fallback for client-side routes (exclude API + public prefixes).
        app.get(/^\/(?!v1|admin|webhooks|internal|health|openapi|docs|u\/).*/, (_req, res) =>
            res.sendFile(path.join(adminDist, 'index.html')),
        );
        Logger.info('serving admin SPA from admin/dist');
    }

    app.use((req, _res, next) => next(notFound(`No route for ${req.method} ${req.path}`, 'route_not_found')));
    app.use(errorHandler);

    return app;
}

export default createApp;
