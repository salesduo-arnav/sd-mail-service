import { Router } from 'express';
import { requireServiceAuth } from '../middlewares/serviceAuth';
import { sendInternalEmail } from '../controllers/internal.controller';

const router = Router();

// Forward-compat with core-platform's internal API (X-Service-Key auth).
router.post('/email/send', requireServiceAuth, sendInternalEmail);

export default router;
