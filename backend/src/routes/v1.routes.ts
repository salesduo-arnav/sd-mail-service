import { Router } from 'express';
import { apiKeyAuth } from '../middlewares/apiKeyAuth';
import { postEvent, postSubscriber, postActivity } from '../controllers/events.controller';
import { postMessage } from '../controllers/messages.controller';

const router = Router();

// All /v1 producer endpoints require a product API key.
router.use(apiKeyAuth);

router.post('/events', postEvent);
router.post('/events/activity', postActivity);
router.post('/subscribers', postSubscriber);
router.post('/messages', postMessage); // transactional, synchronous

export default router;
