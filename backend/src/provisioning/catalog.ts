import { Product } from '../models/product';
import { Template } from '../models/template';
import { Workflow } from '../models/workflow';
import { WorkflowVersion } from '../models/workflow_version';
import { MessageType, Step, TemplateCtaJson } from '../types/workflow';
import Logger from '../utils/logger';

// Canonical SalesDuo mail catalog — the products/templates/workflows that the two
// migration runbooks describe, as data. `provisionCatalog()` upserts them idempotently
// (findOrCreate), so it's safe to run on every seed and from the admin "Provision" button.
//
// Static CTA links (marketing nudges) are literal, per-environment URLs; edit them in the
// admin per env if needed. Dynamic links (reset/invite/project/download) stay as `{{ data.* }}`.
const CREATIVES_URL = 'https://creatives.salesduo.com';
const APP_URL = 'https://app.salesduo.com';
const TUTORIAL_URL = 'https://help.salesduo.com/creative-studio';

interface TemplateDef {
    key: string;
    type: MessageType;
    subject: string;
    body: string;
    cta?: TemplateCtaJson;
}

interface WorkflowDef {
    key: string;
    name: string;
    trigger_event_key: string;
    category: string;
    enabled: boolean;
    steps: Step[];
}

interface ProductDef {
    slug: string;
    name: string;
    brand_name: string;
    brand_color: string;
    from_email: string;
    reply_to_email: string;
    templates: TemplateDef[];
    workflows: WorkflowDef[];
}

export const CATALOG: ProductDef[] = [
    {
        slug: 'core-platform',
        name: 'Core Platform',
        brand_name: 'SalesDuo',
        brand_color: '#ff9900',
        from_email: '"SalesDuo" <no-reply@salesduo.com>',
        reply_to_email: 'support@salesduo.com',
        templates: [
            {
                key: 'login_otp',
                type: 'transactional',
                subject: 'Your login code',
                body: `<p>Hi {{ first_name }},</p>
<p>Your login code is:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px;">{{ otp }}</p>
<p>It expires in {{ expires_minutes }} minutes. If you didn't request it, you can ignore this email.</p>`,
            },
            {
                key: 'signup_otp',
                type: 'transactional',
                subject: 'Verify your email - {{ brand_name }}',
                body: `<p>Welcome to {{ brand_name }}!</p>
<p>Use this code to verify your email:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px;">{{ otp }}</p>
<p>It expires in {{ expires_minutes }} minutes.</p>`,
            },
            {
                key: 'password_reset',
                type: 'transactional',
                subject: 'Reset your password - {{ brand_name }}',
                body: `<p>Hi {{ first_name }},</p>
<p>We received a request to reset your password. Click the button below to choose a new one.</p>
<p>This link expires in {{ expires_minutes }} minutes. If you didn't request it, you can safely ignore this email.</p>`,
                cta: { primary: { label: 'Reset Password', url: '{{ data.reset_url }}' } },
            },
            {
                key: 'invitation',
                type: 'transactional',
                subject: "You've been invited to join {{ org_name }} on {{ brand_name }}",
                body: `<p>You've been invited to join <strong>{{ org_name }}</strong> on {{ brand_name }}.</p>
<p>Click the button below to accept the invitation and set up your account.</p>`,
                cta: { primary: { label: 'Accept Invitation', url: '{{ data.invite_url }}' } },
            },
            {
                key: 'contact_notify',
                type: 'transactional',
                subject: '[Contact] {{ subject }} — {{ name }}',
                body: `<p><strong>From:</strong> {{ name | escape }} &lt;{{ email | escape }}&gt;</p>
<p><strong>Category:</strong> {{ category | default: "—" }} · <strong>Source:</strong> {{ source | default: "—" }} · <strong>Org:</strong> {{ org_name | default: "—" }}</p>
<p><strong>Subject:</strong> {{ subject | escape }}</p>
<hr/>
<p>{{ message | escape | newline_to_br }}</p>`,
            },
        ],
        workflows: [],
    },
    {
        slug: 'creative-studio',
        name: 'Creative Studio',
        brand_name: 'SalesDuo AI Creative Studio',
        brand_color: '#EA580C',
        from_email: '"SalesDuo AI Creative Studio" <no-reply@salesduo.com>',
        reply_to_email: 'support@salesduo.com',
        templates: [
            // --- transactional (share invites + batch complete) ---
            {
                key: 'project_shared',
                type: 'transactional',
                subject: '{{ sharer_name }} shared a project with you',
                body: `<p><strong>{{ sharer_name }}</strong> has given you <strong>{{ role }}</strong> access to the project <strong>{{ project_name }}</strong> on SalesDuo AI Creative Studio.</p>`,
                cta: { primary: { label: 'Open Project', url: '{{ data.project_url }}' } },
            },
            {
                key: 'seo_project_shared',
                type: 'transactional',
                subject: '{{ sharer_name }} shared an SEO project with you',
                body: `<p><strong>{{ sharer_name }}</strong> has given you <strong>{{ role }}</strong> access to the SEO project <strong>{{ project_name }}</strong> on SalesDuo AI Creative Studio.</p>`,
                cta: { primary: { label: 'Open SEO Project', url: '{{ data.project_url }}' } },
            },
            {
                key: 'batch_shared',
                type: 'transactional',
                subject: '{{ sharer_name }} shared a batch with you',
                body: `<p><strong>{{ sharer_name }}</strong> has given you <strong>{{ role }}</strong> access to the batch <strong>{{ project_name }}</strong> on SalesDuo AI Creative Studio.</p>`,
                cta: { primary: { label: 'Open Batch', url: '{{ data.project_url }}' } },
            },
            {
                key: 'batch_complete',
                type: 'transactional',
                subject: 'Your batch creative generation is complete',
                body: `<p>Your batch creative generation job has finished processing.</p>
<p><strong>Total ASINs:</strong> {{ total }} · <strong>Completed:</strong> {{ completed }} · <strong>Failed:</strong> {{ failed }}</p>
<p>Your results are ready to download. This link expires in 7 days.</p>`,
                cta: { primary: { label: 'Download Results (.zip)', url: '{{ data.download_url }}' } },
            },
            // --- marketing (lifecycle nudges) ---
            {
                key: 'welcome',
                type: 'marketing',
                subject: 'Welcome to SalesDuo AI Creative Studio',
                body: `<p>Hi {{ first_name }},</p>
<p>Welcome to SalesDuo's AI Creative Studio.</p>
<p>You can now start creating Amazon compliant product creatives, SEO &amp; AEO content directly by entering your ASINs.</p>
<p>To get started:</p>
<ul><li>Connect your Seller/Vendor Central account</li><li>Add a single ASIN or upload ASINs in bulk</li><li>Generate product images, premium A+ content and SEO &amp; AEO listing content</li></ul>
<p>We've also added a quick tutorial to help you understand the full flow.</p>
<p>Regards,<br/>Team SalesDuo</p>`,
                cta: {
                    primary: { label: 'Start creating', url: `${CREATIVES_URL}/app/optimize` },
                    secondary: { label: 'Watch tutorial', url: TUTORIAL_URL },
                },
            },
            {
                key: 'no_integration_1d',
                type: 'marketing',
                subject: 'Connect your Seller/Vendor Central to get started',
                body: `<p>Hi {{ first_name }},</p>
<p>Your AI Creative Studio account is created, but your Seller/Vendor Central account is not connected yet.</p>
<p>The integration is required because it helps us fetch your catalog details, reduce product and technical spec hallucinations and generate accurate creatives, SEO &amp; AEO content. Once connected, you'll be able to start generating content for your ASINs.</p>
<p>Regards,<br/>Team SalesDuo</p>`,
                cta: {
                    primary: { label: 'Connect Seller Central', url: `${CREATIVES_URL}/app/integrations` },
                    secondary: { label: 'Setup tutorial', url: TUTORIAL_URL },
                },
            },
            {
                key: 'no_generation_2d',
                type: 'marketing',
                subject: "You're ready — generate your first Amazon listing",
                body: `<p>Hi {{ first_name }},</p>
<p>Your Seller Central account is connected. You're now ready to generate your first Amazon listing using AI Creative Studio.</p>
<p>You can start with one ASIN or upload multiple ASINs in bulk to create product images, premium A+ content, SEO &amp; AEO listing content.</p>
<p>We've attached a quick tutorial to help you run your first generation.</p>
<p>Regards,<br/>Team SalesDuo</p>`,
                cta: {
                    primary: { label: 'Generate your first listing', url: `${CREATIVES_URL}/app/optimize` },
                    secondary: { label: 'Generation tutorial', url: TUTORIAL_URL },
                },
            },
            {
                key: 'trial_ended',
                type: 'marketing',
                subject: 'Your AI Creative Studio trial has ended',
                body: `<p>Hi {{ first_name }},</p>
<p>Your AI Creative Studio trial has now ended. You can continue with a paid plan to start creating Amazon ready product creatives, premium A+ content, Alexa for Shopping (Rufus) &amp; COSMO optimized AEO and SEO listing content for your products.</p>
<p>AI Creative Studio helps your team move faster without depending on long design cycles, multiple revision rounds or expensive creative support.</p>
<p>Choose a plan and continue building your creative workflow.</p>
<p>Best,<br/>Team SalesDuo</p>`,
                cta: { primary: { label: 'Upgrade your account', url: `${APP_URL}/billing` } },
            },
            {
                key: 'inactive_14d',
                type: 'marketing',
                subject: 'Your listings are waiting — come back to Creative Studio',
                body: `<p>Hi {{ first_name }},</p>
<p>We noticed you haven't used AI Creative Studio in the last 2 weeks.</p>
<p>E-commerce discovery is changing fast. Product listings are no longer competing only on images and keywords — they now need to be ready for AI search, AEO, marketplace algorithms and shopping assistants that influence how buyers discover and compare products. That means static creatives and outdated listing content can quickly start falling behind.</p>
<p>With AI Creative Studio, you can create Amazon ready product creatives, premium A+ content, Alexa for Shopping (Rufus) &amp; COSMO optimized AEO and SEO listing content for your products.</p>
<p>Now is a good time to come back, refresh your listings, and make sure your products are ready for the way shoppers are discovering products today.</p>
<p>Best,<br/>Team SalesDuo</p>`,
                cta: { primary: { label: 'Continue creating', url: `${CREATIVES_URL}/app/optimize` } },
            },
            {
                key: 'abandoned_checkout_1d',
                type: 'marketing',
                subject: 'Complete your AI Creative Studio upgrade',
                body: `<p>Hi {{ first_name }},</p>
<p>You're one step away from unlocking AI Creative Studio. Complete your checkout to start creating Amazon-ready creatives, premium A+ content and SEO/AEO listing content.</p>
<p>Best,<br/>Team SalesDuo</p>`,
                cta: { primary: { label: 'Complete checkout', url: `${APP_URL}/billing` } },
            },
        ],
        workflows: [
            {
                key: 'welcome',
                name: 'Welcome (immediate)',
                trigger_event_key: 'trial_started',
                category: 'onboarding',
                enabled: true,
                steps: [{ type: 'send', channel: 'email', template: 'welcome' }],
            },
            {
                key: 'no_integration_1d',
                name: 'No integration after 1 day',
                trigger_event_key: 'trial_started',
                category: 'onboarding',
                enabled: true,
                steps: [
                    { type: 'delay', duration: '1d' },
                    { type: 'cancel_on', event_keys: ['integration_connected'] },
                    { type: 'send', channel: 'email', template: 'no_integration_1d' },
                ],
            },
            {
                key: 'no_generation_2d',
                name: 'Connected but no generation after 2 days',
                trigger_event_key: 'integration_connected',
                category: 'onboarding',
                enabled: true,
                steps: [
                    { type: 'delay', duration: '2d' },
                    { type: 'cancel_on', event_keys: ['generation_completed'] },
                    { type: 'send', channel: 'email', template: 'no_generation_2d' },
                ],
            },
            {
                key: 'trial_ended',
                name: 'Trial ended',
                // Event-driven: core emits `trial_ended` from the subscription-deleted webhook
                // when a trial ends without converting (auto period-end OR manual cancel). No
                // timer/cancel needed — the fact IS the trigger, so this just sends.
                trigger_event_key: 'trial_ended',
                category: 'billing',
                enabled: true,
                steps: [{ type: 'send', channel: 'email', template: 'trial_ended' }],
            },
            {
                key: 'inactive_14d',
                name: 'Inactive for 2 weeks',
                trigger_event_key: 'activity',
                category: 'reengagement',
                enabled: true,
                steps: [
                    { type: 'delay', duration: '14d' },
                    { type: 'cancel_on', event_keys: ['activity'] },
                    { type: 'send', channel: 'email', template: 'inactive_14d' },
                    { type: 'repeat' },
                ],
            },
            {
                key: 'abandoned_checkout_1d',
                name: 'Abandoned checkout after 1 day (Phase 2)',
                trigger_event_key: 'checkout.initiated',
                category: 'billing',
                enabled: false, // Phase 2 — core doesn't emit checkout.* yet
                steps: [
                    { type: 'delay', duration: '1d' },
                    { type: 'cancel_on', event_keys: ['checkout.completed'] },
                    { type: 'send', channel: 'email', template: 'abandoned_checkout_1d' },
                ],
            },
        ],
    },
];

export interface ProvisionSummary {
    products: { created: number; skipped: number };
    templates: { created: number; skipped: number };
    workflows: { created: number; skipped: number };
}

/**
 * Idempotently create the canonical products/templates/workflows. Existing rows are
 * left untouched (findOrCreate by natural key), so this is safe to run repeatedly —
 * on seed and from the admin "Provision catalog" button. It never overwrites edits.
 */
export async function provisionCatalog(opts: { createdBy?: string | null } = {}): Promise<ProvisionSummary> {
    const summary: ProvisionSummary = {
        products: { created: 0, skipped: 0 },
        templates: { created: 0, skipped: 0 },
        workflows: { created: 0, skipped: 0 },
    };

    for (const p of CATALOG) {
        const [product, productCreated] = await Product.findOrCreate({
            where: { slug: p.slug },
            defaults: {
                slug: p.slug,
                name: p.name,
                brand_name: p.brand_name,
                brand_color: p.brand_color,
                from_email: p.from_email,
                reply_to_email: p.reply_to_email,
            },
        });
        summary.products[productCreated ? 'created' : 'skipped']++;

        for (const t of p.templates) {
            const [, created] = await Template.findOrCreate({
                where: { product_id: product.id, key: t.key },
                defaults: {
                    product_id: product.id,
                    key: t.key,
                    type: t.type,
                    channel: 'email',
                    subject: t.subject,
                    body: t.body,
                    cta: t.cta ?? null,
                },
            });
            summary.templates[created ? 'created' : 'skipped']++;
        }

        for (const w of p.workflows) {
            const [workflow, created] = await Workflow.findOrCreate({
                where: { product_id: product.id, key: w.key },
                defaults: {
                    product_id: product.id,
                    key: w.key,
                    name: w.name,
                    trigger_event_key: w.trigger_event_key,
                    category: w.category,
                    audience: 'event_subscriber',
                    enabled: w.enabled,
                },
            });
            // Create v1 on first insert; also self-heal a row that a prior interrupted
            // run left with active_version_id = null (findOrCreate made the workflow but
            // died before the version was written) — otherwise it stays enabled with no
            // steps forever. Reuse an existing version if one is already there.
            if (created || !workflow.active_version_id) {
                const existing = created
                    ? null
                    : await WorkflowVersion.findOne({
                          where: { workflow_id: workflow.id },
                          order: [['version', 'DESC']],
                      });
                const version =
                    existing ??
                    (await WorkflowVersion.create({
                        workflow_id: workflow.id,
                        version: 1,
                        steps: w.steps,
                        created_by: opts.createdBy ?? null,
                    }));
                await workflow.update({ active_version_id: version.id });
            }
            summary.workflows[created ? 'created' : 'skipped']++;
        }
    }

    Logger.info('catalog provisioned', summary as unknown as Record<string, unknown>);
    return summary;
}
