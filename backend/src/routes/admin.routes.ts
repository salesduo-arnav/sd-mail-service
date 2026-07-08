import { Router } from 'express';
import { requireAdmin } from '../middlewares/adminAuth';
import { login, logout, me } from '../controllers/admin/auth.controller';
import {
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    createApiKey,
    revealApiKey,
    revokeApiKey,
} from '../controllers/admin/products.controller';
import {
    listWorkflows,
    getWorkflow,
    createWorkflow,
    updateWorkflow,
    toggleWorkflow,
    activateVersion,
    deleteWorkflow,
} from '../controllers/admin/workflows.controller';
import {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    previewTemplate,
    sendTestTemplate,
    deleteTemplate,
} from '../controllers/admin/templates.controller';
import {
    searchSubscribers,
    getSubscriber,
    suppress,
    unsuppress,
    setSubscriberPreference,
} from '../controllers/admin/subscribers.controller';
import {
    listEvents,
    listRuns,
    getRun,
    listMessages,
    listSuppressions,
    metrics,
} from '../controllers/admin/logs.controller';
import { eventCatalog, categoryCatalog } from '../controllers/admin/catalog.controller';

const router = Router();

// Auth (public)
router.post('/auth/login', login);
router.post('/auth/logout', logout);

// Everything below requires a superadmin session.
router.use(requireAdmin);
router.get('/auth/me', me);

router.get('/products', listProducts);
router.post('/products', createProduct);
router.get('/products/:id', getProduct);
router.patch('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/:id/keys', createApiKey);
router.get('/products/:id/keys/:keyId/reveal', revealApiKey);
router.delete('/products/:id/keys/:keyId', revokeApiKey);

router.get('/workflows', listWorkflows);
router.post('/workflows', createWorkflow);
router.get('/workflows/:id', getWorkflow);
router.patch('/workflows/:id', updateWorkflow);
router.post('/workflows/:id/toggle', toggleWorkflow);
router.post('/workflows/:id/activate-version', activateVersion);
router.delete('/workflows/:id', deleteWorkflow);

router.get('/templates', listTemplates);
router.post('/templates', createTemplate);
router.post('/templates/preview', previewTemplate); // stateless preview (inline content)
router.get('/templates/:id', getTemplate);
router.patch('/templates/:id', updateTemplate);
router.post('/templates/:id/send-test', sendTestTemplate);
router.delete('/templates/:id', deleteTemplate);

router.get('/subscribers', searchSubscribers);
router.get('/subscribers/:id', getSubscriber);
router.post('/subscribers/:id/preferences', setSubscriberPreference);
router.post('/subscribers/suppress', suppress);
router.post('/subscribers/unsuppress', unsuppress);

router.get('/logs/events', listEvents);
router.get('/logs/runs', listRuns);
router.get('/logs/runs/:id', getRun);
router.get('/logs/messages', listMessages);
router.get('/logs/suppressions', listSuppressions);
router.get('/metrics', metrics);

// Catalogs for the workflow builder pickers
router.get('/events/catalog', eventCatalog);
router.get('/categories', categoryCatalog);

export default router;
