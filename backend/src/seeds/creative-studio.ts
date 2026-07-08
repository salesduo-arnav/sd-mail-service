import { Product } from '../models/product';
import { Workflow } from '../models/workflow';
import { WorkflowVersion } from '../models/workflow_version';
import { Template } from '../models/template';
import { hashApiKey } from '../utils/crypto';
import { ApiKey } from '../models/api_key';
import { Step, TemplateCtaJson, MessageType } from '../types/workflow';
import Logger from '../utils/logger';

const LAYOUT = `<!doctype html><html><body style="margin:0;background:#f4f5f7;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <div style="background:{{ brand_color }};padding:18px 24px;color:#fff;font-weight:700;font-size:18px;">{{ brand_name }}</div>
  <div style="padding:24px;line-height:1.55;">{{ content }}</div>
</div></body></html>`;

interface WorkflowDef {
    key: string;
    name: string;
    trigger_event_key: string;
    category: string;
    audience: string;
    steps: Step[];
}

interface TemplateDef {
    key: string;
    type: MessageType;
    workflowKey?: string;
    subject: string;
    body: string;
    cta?: TemplateCtaJson;
    variables?: string[];
}

const WORKFLOWS: WorkflowDef[] = [
    {
        key: 'welcome',
        name: 'Welcome (immediate)',
        trigger_event_key: 'creative_studio.trial_started',
        category: 'onboarding',
        audience: 'event_subscriber',
        steps: [{ type: 'send', channel: 'email', template: 'welcome' }],
    },
    {
        key: 'no_integration_1d',
        name: 'No integration after 1 day',
        trigger_event_key: 'creative_studio.trial_started',
        category: 'onboarding',
        audience: 'event_subscriber',
        steps: [
            { type: 'delay', duration: '1d' },
            { type: 'cancel_on', event_keys: ['creative_studio.integration.connected'] },
            { type: 'send', channel: 'email', template: 'no_integration_1d' },
        ],
    },
    {
        key: 'no_generation_2d',
        name: 'No generation after 2 days',
        trigger_event_key: 'creative_studio.integration.connected',
        category: 'onboarding',
        audience: 'event_subscriber',
        steps: [
            { type: 'delay', duration: '2d' },
            { type: 'cancel_on', event_keys: ['creative_studio.generation.completed'] },
            { type: 'send', channel: 'email', template: 'no_generation_2d' },
        ],
    },
    {
        key: 'trial_ended',
        name: 'Trial ended',
        trigger_event_key: 'creative_studio.trial_started',
        category: 'billing',
        audience: 'org_owner',
        steps: [
            { type: 'delay', duration: 'until:trial_ends_at' },
            { type: 'cancel_on', event_keys: ['creative_studio.plan_purchased'] },
            { type: 'send', channel: 'email', template: 'trial_ended' },
        ],
    },
    {
        key: 'inactive_14d',
        name: 'Inactive for 2 weeks',
        trigger_event_key: 'creative_studio.activity',
        category: 'reengagement',
        audience: 'event_subscriber',
        steps: [
            { type: 'delay', duration: '14d' },
            { type: 'cancel_on', event_keys: ['creative_studio.activity'] },
            { type: 'send', channel: 'email', template: 'inactive_14d' },
            { type: 'repeat' },
        ],
    },
];

const TEMPLATES: TemplateDef[] = [
    {
        key: 'welcome',
        type: 'marketing',
        workflowKey: 'welcome',
        subject: 'Welcome to AI Creative Studio',
        body: `<p>Hi {{ first_name }},</p>
<p>Welcome to SalesDuo's AI Creative Studio.</p>
<p>You can now start creating Amazon compliant product creatives, SEO &amp; AEO content directly by entering your ASINs.</p>
<p>To get started:</p>
<ul><li>Connect your Seller/Vendor Central account</li><li>Add a single ASIN or upload ASINs in bulk</li><li>Generate product images, premium A+ content and SEO &amp; AEO listing content</li></ul>
<p>We've also added a quick tutorial to help you understand the full flow.</p>
<p>Regards,<br/>Team SalesDuo</p>`,
        cta: {
            primary: { label: 'Start creating', url: '{{ data.start_link }}' },
            secondary: { label: 'Watch tutorial', url: '{{ data.tutorial_link }}' },
        },
        variables: ['data.start_link', 'data.tutorial_link'],
    },
    {
        key: 'no_integration_1d',
        type: 'marketing',
        workflowKey: 'no_integration_1d',
        subject: 'Connect your Seller/Vendor Central account',
        body: `<p>Hi {{ first_name }},</p>
<p>Your AI Creative Studio account is created, but your Seller/Vendor Central account is not connected yet.</p>
<p>The integration is required because it helps us fetch your catalog details, reduce product and technical spec hallucinations and generate accurate creatives, SEO &amp; AEO content. Once connected, you'll be able to start generating content for your ASINs.</p>
<p>Regards,<br/>Team SalesDuo</p>`,
        cta: {
            primary: { label: 'Connect Seller Central', url: '{{ data.connect_link }}' },
            secondary: { label: 'Setup tutorial', url: '{{ data.tutorial_link }}' },
        },
        variables: ['data.connect_link', 'data.tutorial_link'],
    },
    {
        key: 'no_generation_2d',
        type: 'marketing',
        workflowKey: 'no_generation_2d',
        subject: 'Generate your first Amazon listing',
        body: `<p>Hi {{ first_name }},</p>
<p>Your Seller Central account is connected. You're now ready to generate your first Amazon listing using AI Creative Studio.</p>
<p>You can start with one ASIN or upload multiple ASINs in bulk to create product images, premium A+ content, SEO &amp; AEO listing content.</p>
<p>We've attached a quick tutorial to help you run your first generation.</p>
<p>Regards,<br/>Team SalesDuo</p>`,
        cta: {
            primary: { label: 'Generate your first listing', url: '{{ data.generate_link }}' },
            secondary: { label: 'Generation tutorial', url: '{{ data.tutorial_link }}' },
        },
        variables: ['data.generate_link', 'data.tutorial_link'],
    },
    {
        key: 'trial_ended',
        type: 'marketing',
        workflowKey: 'trial_ended',
        subject: 'Your AI Creative Studio trial has ended',
        body: `<p>Hi {{ first_name }},</p>
<p>Your AI Creative Studio trial has now ended. You can continue with a paid plan to start creating Amazon ready product creatives, premium A+ content, Alexa for Shopping (Rufus) &amp; COSMO optimized AEO and SEO listing content for your products.</p>
<p>AI Creative Studio helps your team move faster without depending on long design cycles, multiple revision rounds or expensive creative support.</p>
<p>Choose a plan and continue building your creative workflow.</p>
<p>Best,<br/>Team SalesDuo</p>`,
        cta: { primary: { label: 'Upgrade your account', url: '{{ upgrade_link }}' } },
        variables: ['upgrade_link'],
    },
    {
        key: 'inactive_14d',
        type: 'marketing',
        workflowKey: 'inactive_14d',
        subject: "Come back to AI Creative Studio",
        body: `<p>Hi {{ first_name }},</p>
<p>We noticed you haven't used AI Creative Studio in the last 2 weeks.</p>
<p>E-commerce discovery is changing fast. Product listings now need to be ready for AI search, AEO, marketplace algorithms and shopping assistants that influence how buyers discover and compare products.</p>
<p>With AI Creative Studio, you can create Amazon ready product creatives, premium A+ content, Alexa for Shopping (Rufus) &amp; COSMO optimized AEO and SEO listing content for your products.</p>
<p>Now is a good time to come back, refresh your listings, and make sure your products are ready for the way shoppers are discovering products today.</p>
<p>Best,<br/>Team SalesDuo</p>`,
        cta: { primary: { label: 'Continue creating', url: '{{ login_link }}' } },
        variables: ['login_link'],
    },
    // Transactional template (no workflow) — used to exercise the transactional gate.
    {
        key: 'login_otp',
        type: 'transactional',
        subject: 'Your AI Creative Studio login code',
        body: `<p>Hi {{ first_name }},</p>
<p>Your login code is <strong style="font-size:20px;letter-spacing:2px;">{{ otp }}</strong></p>
<p>It expires in {{ expires_minutes }} minutes. If you didn't request it, you can ignore this email.</p>`,
        variables: ['otp', 'expires_minutes'],
    },
];

const DEV_KEY = 'sdm_cs_dev_key_do_not_use_in_prod';

export async function seedCreativeStudio(): Promise<void> {
    const [product] = await Product.findOrCreate({
        where: { slug: 'creative-studio' },
        defaults: {
            slug: 'creative-studio',
            name: 'AI Creative Studio',
            brand_name: 'SalesDuo',
            brand_color: '#ff9900',
            from_email: 'AI Creative Studio <studio@salesduo.com>',
            reply_to_email: 'support@salesduo.com',
            layout_html: LAYOUT,
        },
    });

    // API key
    await ApiKey.findOrCreate({
        where: { key_hash: hashApiKey(DEV_KEY) },
        defaults: { product_id: product.id, name: 'creative-studio dev key', key_hash: hashApiKey(DEV_KEY) },
    });

    // Workflows + a v1 version each
    for (const def of WORKFLOWS) {
        const [wf] = await Workflow.findOrCreate({
            where: { product_id: product.id, key: def.key },
            defaults: {
                product_id: product.id,
                key: def.key,
                name: def.name,
                trigger_event_key: def.trigger_event_key,
                category: def.category,
                audience: def.audience,
            },
        });
        if (!wf.active_version_id) {
            const version = await WorkflowVersion.create({ workflow_id: wf.id, version: 1, steps: def.steps });
            await wf.update({ active_version_id: version.id });
        }
    }

    // Templates
    for (const def of TEMPLATES) {
        const workflow_id = def.workflowKey
            ? (await Workflow.findOne({ where: { product_id: product.id, key: def.workflowKey } }))?.id ?? null
            : null;
        await Template.findOrCreate({
            where: { product_id: product.id, key: def.key },
            defaults: {
                product_id: product.id,
                key: def.key,
                type: def.type,
                workflow_id,
                channel: 'email',
                subject: def.subject,
                body: def.body,
                cta: def.cta ?? null,
                variables: def.variables ?? null,
            },
        });
    }

    Logger.info('Creative Studio seeded.');
    console.log(`  creative-studio  →  ${DEV_KEY}`);
}
