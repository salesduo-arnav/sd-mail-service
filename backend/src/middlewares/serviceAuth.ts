import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import env from '../config/env';
import { unauthorized } from '../utils/errors';

function safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Internal service auth via a shared key (X-Service-Key) — the same scheme
 * core-platform uses for its /internal/* endpoints. Guards all producer endpoints:
 * /internal/events, /internal/messages, and /internal/email/send.
 */
export function requireServiceAuth(req: Request, _res: Response, next: NextFunction) {
    const key = req.header('x-service-key');
    if (!key || !safeEqual(key, env.INTERNAL_API_KEY)) throw unauthorized('Invalid service key', 'invalid_service_key');
    req.serviceName = req.header('x-service-name') || 'unknown';
    next();
}
