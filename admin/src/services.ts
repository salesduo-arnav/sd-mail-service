import { api } from './lib/api';
import type {
    Product,
    Workflow,
    WorkflowVersion,
    Template,
    Subscriber,
    Preference,
    Suppression,
    Message,
    WorkflowRun,
    RunStep,
    Metrics,
    Campaign,
    Step,
    TemplateCta,
    MessageType,
    Channel,
    SuppressionReason,
} from './types';

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const authApi = {
    me: () => data<{ admin_id: string; email: string }>(api.get('/admin/auth/me', { skipErrorToast: true })),
    login: (email: string, password: string) =>
        data<{ id: string; email: string; name: string }>(
            api.post('/admin/auth/login', { email, password }, { skipErrorToast: true }),
        ),
    logout: () => data(api.post('/admin/auth/logout')),
};

export const productsApi = {
    list: () => data<Product[]>(api.get('/admin/products')),
    get: (id: string) => data<{ product: Product }>(api.get(`/admin/products/${id}`)),
    create: (body: Partial<Product>) => data<Product>(api.post('/admin/products', body)),
    update: (id: string, body: Partial<Product>) => data<Product>(api.patch(`/admin/products/${id}`, body)),
    remove: (id: string) => data(api.delete(`/admin/products/${id}`)),
};

export interface ProvisionSummary {
    products: { created: number; skipped: number };
    templates: { created: number; skipped: number };
    workflows: { created: number; skipped: number };
}

export const provisioningApi = {
    run: () => data<ProvisionSummary>(api.post('/admin/provisioning')),
};

export interface WorkflowInput {
    product_id: string;
    key: string;
    name: string;
    trigger_event_key: string;
    category: string;
    audience: string;
    steps: Step[];
}

export const workflowsApi = {
    list: (productId: string) => data<Workflow[]>(api.get(`/admin/workflows?product_id=${productId}`)),
    get: (id: string) =>
        data<{ workflow: Workflow; active_version: WorkflowVersion | null; versions: WorkflowVersion[] }>(
            api.get(`/admin/workflows/${id}`),
        ),
    create: (body: WorkflowInput) => data(api.post('/admin/workflows', body)),
    update: (id: string, body: Partial<WorkflowInput>) => data(api.patch(`/admin/workflows/${id}`, body)),
    toggle: (id: string, enabled: boolean) => data(api.post(`/admin/workflows/${id}/toggle`, { enabled })),
    activateVersion: (id: string, versionId: string) =>
        data(api.post(`/admin/workflows/${id}/activate-version`, { version_id: versionId })),
    remove: (id: string) => data(api.delete(`/admin/workflows/${id}`)),
};

export interface TemplateInput {
    product_id: string;
    key: string;
    type: MessageType;
    subject: string | null;
    body: string | null;
    cta: TemplateCta | null;
}

export const templatesApi = {
    list: (productId: string) => data<Template[]>(api.get(`/admin/templates?product_id=${productId}`)),
    get: (id: string) => data<Template>(api.get(`/admin/templates/${id}`)),
    create: (body: TemplateInput) => data<Template>(api.post('/admin/templates', body)),
    update: (id: string, body: Partial<TemplateInput>) => data<Template>(api.patch(`/admin/templates/${id}`, body)),
    remove: (id: string) => data(api.delete(`/admin/templates/${id}`)),
    preview: (body: {
        product_id: string;
        subject: string | null;
        body: string | null;
        cta: TemplateCta | null;
        type: MessageType;
        data: Record<string, unknown>;
    }) => data<{ subject: string; html: string }>(api.post('/admin/templates/preview', body)),
    sendTest: (id: string, to: string, sampleData: Record<string, unknown>) =>
        data<{ ok: boolean; to: string }>(api.post(`/admin/templates/${id}/send-test`, { to, data: sampleData })),
};

export interface SubscriberInput {
    external_id: string;
    email?: string | null;
    name?: string | null;
    timezone?: string | null;
    attributes?: Record<string, unknown>;
}

export const subscribersApi = {
    search: (productId: string, q: string) =>
        data<Subscriber[]>(api.get(`/admin/subscribers?product_id=${productId}&q=${encodeURIComponent(q)}`)),
    create: (productId: string, body: SubscriberInput) =>
        data<Subscriber>(api.post(`/admin/subscribers?product_id=${productId}`, body)),
    get: (id: string) =>
        data<{ subscriber: Subscriber; preferences: Preference[]; messages: Message[]; suppressions: Suppression[] }>(
            api.get(`/admin/subscribers/${id}`),
        ),
    setPreference: (id: string, category: string, channel: Channel, status: 'subscribed' | 'unsubscribed') =>
        data<{ preferences: Preference[] }>(api.post(`/admin/subscribers/${id}/preferences`, { category, channel, status })),
    suppress: (productId: string, email: string, reason: SuppressionReason) =>
        data(api.post(`/admin/subscribers/suppress?product_id=${productId}`, { email, reason })),
    unsuppress: (productId: string, email: string, reason?: SuppressionReason) =>
        data(api.post(`/admin/subscribers/unsuppress?product_id=${productId}`, { email, reason })),
};

export const logsApi = {
    events: (productId: string, limit = 100) =>
        data<Record<string, unknown>[]>(api.get(`/admin/logs/events?product_id=${productId}&limit=${limit}`)),
    runs: (productId: string, status = '', limit = 100) =>
        data<WorkflowRun[]>(api.get(`/admin/logs/runs?product_id=${productId}&status=${status}&limit=${limit}`)),
    run: (id: string) =>
        data<{ run: WorkflowRun; steps: RunStep[]; messages: Message[] }>(api.get(`/admin/logs/runs/${id}`)),
    messages: (productId: string, status = '', type = '', limit = 100) =>
        data<Message[]>(
            api.get(`/admin/logs/messages?product_id=${productId}&status=${status}&type=${type}&limit=${limit}`),
        ),
    suppressions: (productId: string, limit = 100) =>
        data<Suppression[]>(api.get(`/admin/logs/suppressions?product_id=${productId}&limit=${limit}`)),
    metrics: (productId: string) => data<Metrics>(api.get(`/admin/metrics?product_id=${productId}`)),
};

export const catalogApi = {
    events: (productId: string) => data<string[]>(api.get(`/admin/events/catalog?product_id=${productId}`)),
    categories: (productId: string) => data<string[]>(api.get(`/admin/categories?product_id=${productId}`)),
};

export interface CampaignInput {
    product_id: string;
    name: string;
    category: string;
    template_id?: string | null;
    subject?: string | null;
    body?: string | null;
    cta?: TemplateCta | null;
}

export const campaignsApi = {
    list: (productId: string) => data<Campaign[]>(api.get(`/admin/campaigns?product_id=${productId}`)),
    get: (id: string) => data<Campaign>(api.get(`/admin/campaigns/${id}`)),
    audienceCount: (productId: string) =>
        data<{ count: number }>(api.get(`/admin/campaigns/audience-count?product_id=${productId}`)),
    create: (body: CampaignInput) => data<Campaign>(api.post('/admin/campaigns', body)),
    resend: (id: string) => data(api.post(`/admin/campaigns/${id}/resend`)),
};
