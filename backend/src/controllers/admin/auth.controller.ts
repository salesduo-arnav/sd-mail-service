import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler, badRequest, unauthorized } from '../../utils/errors';
import { AdminUser } from '../../models/admin_user';
import { issueAdminCookie, clearAdminCookie } from '../../middlewares/adminAuth';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const login = asyncHandler(async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('email and password required', 'validation_error');
    const admin = await AdminUser.findOne({ where: { email: parsed.data.email.toLowerCase() } });
    if (!admin || !admin.password_hash || !(await bcrypt.compare(parsed.data.password, admin.password_hash))) {
        throw unauthorized('Invalid credentials', 'invalid_credentials');
    }
    issueAdminCookie(res, { admin_id: admin.id, email: admin.email });
    res.json({ id: admin.id, email: admin.email, name: admin.name });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
    clearAdminCookie(res);
    res.json({ ok: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
    res.json({ admin_id: req.admin!.admin_id, email: req.admin!.email });
});
