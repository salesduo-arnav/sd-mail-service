import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, notFound } from '../../utils/errors';
import { Template } from '../../models/template';
import { Product } from '../../models/product';
import { renderEmail } from '../../services/render/layout';
import { validateLiquid } from '../../services/render/liquid';
import { emailDriver } from '../../services/delivery/email-driver';

const ctaSchema = z
    .object({
        primary: z.object({ label: z.string(), url: z.string() }).optional(),
        secondary: z.object({ label: z.string(), url: z.string() }).optional(),
    })
    .nullable()
    .optional();

const templateSchema = z.object({
    product_id: z.string().uuid(),
    key: z.string().min(1),
    type: z.enum(['transactional', 'marketing']).default('marketing'),
    channel: z.enum(['email', 'slack', 'in_app', 'sms']).default('email'),
    subject: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    cta: ctaSchema,
});

async function assertValidLiquid(subject?: string | null, body?: string | null): Promise<void> {
    for (const [name, tpl] of [
        ['subject', subject],
        ['body', body],
    ] as const) {
        if (tpl) {
            const err = await validateLiquid(tpl);
            if (err) throw badRequest(`Invalid Liquid in ${name}: ${err}`, 'invalid_liquid');
        }
    }
}

export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
    const where: Record<string, unknown> = {};
    if (req.query.product_id) where.product_id = req.query.product_id;
    const templates = await Template.findAll({ where, order: [['updated_at', 'DESC']] });
    res.json(templates);
});

export const getTemplate = asyncHandler(async (req: Request, res: Response) => {
    const template = await Template.findByPk(req.params.id);
    if (!template) throw notFound('Template not found');
    res.json(template);
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid template', 'validation_error', parsed.error.flatten());
    await assertValidLiquid(parsed.data.subject, parsed.data.body);
    const template = await Template.create(parsed.data);
    res.status(201).json(template);
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const template = await Template.findByPk(req.params.id);
    if (!template) throw notFound('Template not found');
    const parsed = templateSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid template', 'validation_error', parsed.error.flatten());
    await assertValidLiquid(parsed.data.subject, parsed.data.body);
    await template.update(parsed.data);
    res.json(template);
});

const renderInput = (template: Template, product: Product, data: Record<string, unknown>) => ({
    subject: template.subject ?? '',
    body: template.body ?? '',
    cta: template.cta,
    subscriber: { name: (data.name as string) ?? 'Jane Doe', email: (data.email as string) ?? 'jane@example.com' },
    data,
    brand: product,
    layoutHtml: product.layout_html,
    // preview marketing with a placeholder footer link so admins see it
    unsubscribeUrl: template.type === 'marketing' ? '#unsubscribe' : null,
    supportEmail: product.reply_to_email,
});

const previewSchema = z.object({
    product_id: z.string().uuid(),
    subject: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    cta: ctaSchema,
    type: z.enum(['transactional', 'marketing']).default('marketing'),
    data: z.record(z.unknown()).optional(),
});

/**
 * Live preview — renders the supplied (inline) template content with sample data.
 * Stateless: it does NOT persist anything, so previewing never mutates the saved
 * template (works for unsaved/new templates too).
 */
export const previewTemplate = asyncHandler(async (req: Request, res: Response) => {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid preview request', 'validation_error', parsed.error.flatten());
    const product = await Product.findByPk(parsed.data.product_id);
    if (!product) throw notFound('Product not found');
    const data = (parsed.data.data ?? {}) as Record<string, unknown>;
    const rendered = await renderEmail({
        subject: parsed.data.subject ?? '',
        body: parsed.data.body ?? '',
        cta: parsed.data.cta ?? null,
        subscriber: { name: (data.name as string) ?? 'Jane Doe', email: (data.email as string) ?? 'jane@example.com' },
        data,
        brand: product,
        layoutHtml: product.layout_html,
        unsubscribeUrl: parsed.data.type === 'marketing' ? '#unsubscribe' : null,
        supportEmail: product.reply_to_email,
    });
    res.json(rendered);
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
    const template = await Template.findByPk(req.params.id);
    if (!template) throw notFound('Template not found');
    await template.destroy();
    res.json({ ok: true });
});

/** Send a test render to an email address (defaults to the admin's own). */
export const sendTestTemplate = asyncHandler(async (req: Request, res: Response) => {
    const template = await Template.findByPk(req.params.id);
    if (!template) throw notFound('Template not found');
    const product = await Product.findByPk(template.product_id);
    if (!product) throw notFound('Product not found');
    const to = z.string().email().safeParse(req.body?.to ?? req.admin?.email);
    if (!to.success) throw badRequest('Valid "to" email required', 'validation_error');
    const data = (req.body?.data ?? {}) as Record<string, unknown>;
    const rendered = await renderEmail(renderInput(template, product, data));
    const result = await emailDriver().send({
        from: product.from_email,
        to: to.data,
        replyTo: product.reply_to_email ?? undefined,
        subject: `[TEST] ${rendered.subject}`,
        html: rendered.html,
    });
    res.json({ ok: true, to: to.data, provider_message_id: result.providerMessageId });
});
