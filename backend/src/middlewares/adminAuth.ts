import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import { asyncHandler, unauthorized } from '../utils/errors';
import { AdminUser } from '../models/admin_user';

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
 * Verifies the signed session cookie AND that the admin still exists — so a token for
 * a deleted/reset admin is rejected (forces re-login) rather than being trusted, which
 * also guarantees `created_by` foreign keys always reference a live admin.
 */
export const requireAdmin = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[COOKIE];
    if (!token) throw unauthorized('Admin login required', 'admin_unauthenticated');

    let session: AdminSession;
    try {
        session = jwt.verify(token, env.ADMIN_SESSION_SECRET, { algorithms: ['HS256'] }) as AdminSession;
    } catch {
        throw unauthorized('Invalid or expired admin session', 'admin_session_invalid');
    }

    const admin = await AdminUser.findByPk(session.admin_id);
    if (!admin) throw unauthorized('Session no longer valid — please sign in again', 'admin_session_invalid');

    req.admin = { admin_id: admin.id, email: admin.email };
    next();
});
