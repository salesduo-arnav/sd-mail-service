import { Router } from 'express';
import { requireServiceAuth } from '../middlewares/serviceAuth';
import { postEmailFeedback } from '../controllers/webhooks.controller';

const router = Router();

// Provider feedback (bounce/complaint). Service-key auth.
router.post('/email', requireServiceAuth, postEmailFeedback);

export default router;
