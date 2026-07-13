import { Router } from 'express';
import { requireServiceAuth } from '../middlewares/serviceAuth';
import { sendInternalEmail, postInternalEvent, postInternalMessage } from '../controllers/internal.controller';

const router = Router();

// Service-to-service plane (X-Service-Key auth). Product is named via `product_slug`
// in the body, so trusted first-party producers use one shared key for every product.
router.post('/email/send', requireServiceAuth, sendInternalEmail);
router.post('/events', requireServiceAuth, postInternalEvent);
router.post('/messages', requireServiceAuth, postInternalMessage);

export default router;
