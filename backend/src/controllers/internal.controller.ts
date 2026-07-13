import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest } from '../utils/errors';
import { Message } from '../models/message';
import { emailDriver } from '../services/delivery/email-driver';
import { ingestEvent, eventSchema, MAX_DATA_BYTES } from '../services/ingest.service';
import { findProductBySlug } from '../services/product.service';
import { messageBodySchema, sendTransactionalMessage } from '../services/message.service';
import env from '../config/env';
import Logger from '../utils/logger';

// Accept `to` as a single string OR an array (studio sends string, buybox sends string[]).
const schema = z.object({
    to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
    subject: z.string().min(1),
    html: z.string().optional(),
    text: z.string().optional(),
    product_slug: z.string().optional(),
});

/**
 * POST /internal/email/send — drop-in replacement for core-platform's endpoint so
 * studio (`SdInfraClient.send_email`) and sd-buybox can repoint by changing only the
 * base URL (Phase 6). Sends a pre-rendered email as transactional (no footer). If a
 * product_slug is given, branding + a message log row are attributed to it.
 */
export const sendInternalEmail = asyncHandler(async (req: Request, res: Response) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest('to + subject and (html or text) required', 'validation_error');
    const { to, subject, html, text, product_slug } = parsed.data;
    if (!html && !text) throw badRequest('html or text body required', 'validation_error');

    // A provided-but-unknown slug is a caller mistake — 404 it (like /events and
    // /messages) rather than silently sending unbranded, untracked mail. Omitting the
    // slug is still valid: a pre-rendered raw relay with no product attribution.
    const product = product_slug ? await findProductBySlug(product_slug) : null;
    const from = product?.from_email ?? env.SMTP_FROM;
    const recipients = Array.isArray(to) ? to : [to];

    const result = await emailDriver().send({
        from,
        to: recipients,
        subject,
        html,
        text,
        replyTo: product?.reply_to_email ?? undefined,
    });

    // Best-effort log (one row per recipient) when we can attribute a product.
    if (product) {
        await Promise.all(
            recipients.map((addr) =>
                Message.create({
                    product_id: product.id,
                    type: 'transactional',
                    to_email: addr,
                    channel: 'email',
                    provider_message_id: result.providerMessageId ?? null,
                    status: 'sent',
                    sent_at: new Date(),
                }),
            ),
        );
    }

    Logger.info('internal email sent', { to: recipients, subject, source: req.serviceName });
    res.json({ message: 'Email sent', source: req.serviceName });
});

const internalEventSchema = eventSchema.extend({ product_slug: z.string().min(1) });
const internalMessageSchema = messageBodySchema.extend({ product_slug: z.string().min(1) });

/**
 * POST /internal/events — ingest a lifecycle event. Product resolved from `product_slug`,
 * auth via the shared service key (X-Service-Key). For trusted first-party producers.
 */
export const postInternalEvent = asyncHandler(async (req: Request, res: Response) => {
    const parsed = internalEventSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid request body', 'validation_error', parsed.error.flatten());
    const { product_slug, ...event } = parsed.data;
    if (event.data && JSON.stringify(event.data).length > MAX_DATA_BYTES) {
        throw badRequest('data payload too large (max 32KB)', 'payload_too_large');
    }
    const product = await findProductBySlug(product_slug);
    const result = await ingestEvent(product.id, event);
    res.status(202).json({ id: result.id, deduped: result.deduped, subscriber_id: result.subscriberId });
});

/**
 * POST /internal/messages — send a transactional template message. Product resolved from
 * `product_slug`, auth via the shared service key (X-Service-Key).
 */
export const postInternalMessage = asyncHandler(async (req: Request, res: Response) => {
    const parsed = internalMessageSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid request body', 'validation_error', parsed.error.flatten());
    const { product_slug, ...body } = parsed.data;
    const product = await findProductBySlug(product_slug);
    const { status, body: payload } = await sendTransactionalMessage(product, body);
    res.status(status).json(payload);
});
