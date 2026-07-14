import { Router } from 'express';
import { getUnsubscribe, postUnsubscribe } from '../controllers/unsubscribe.controller';

const router = Router();

// Public, unauthenticated (token-signed). GET shows a confirmation page (no state change,
// so link scanners can't unsubscribe a user); POST performs it (button + one-click).
router.get('/u/:token', getUnsubscribe);
router.post('/u/:token', postUnsubscribe);

export default router;
