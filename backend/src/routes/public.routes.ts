import { Router } from 'express';
import { getUnsubscribe } from '../controllers/unsubscribe.controller';

const router = Router();

// Public, unauthenticated (token-signed).
router.get('/u/:token', getUnsubscribe);

export default router;
