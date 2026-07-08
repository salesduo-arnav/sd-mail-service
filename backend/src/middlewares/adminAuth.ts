import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import { unauthorized } from '../utils/errors';

const COOKIE = 'sdmail_admin';

export interface AdminSession {
    admin_id: string;
    email: string;
}

export function issueAdminCookie(res: Response, session: AdminSession): void {
    const token = jwt.sign(session, env.ADMIN_SESSION_SECRET, { expiresIn: '24h', algorithm: 'HS256' });
    res.cookie(COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        maxAge: 24 * 3600 * 1000,
    });
}

export function clearAdminCookie(res: Response): void {
    res.clearCookie(COOKIE);
}

/**
 * Superadmin session guard (single admin type, no RBAC — full cross-product access).
 * Verifies the signed session cookie on every Admin API call.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
    const token = req.cookies?.[COOKIE];
    if (!token) throw unauthorized('Admin login required', 'admin_unauthenticated');
    try {
        const session = jwt.verify(token, env.ADMIN_SESSION_SECRET, { algorithms: ['HS256'] }) as AdminSession;
        req.admin = session;
        next();
    } catch {
        throw unauthorized('Invalid or expired admin session', 'admin_session_invalid');
    }
}
