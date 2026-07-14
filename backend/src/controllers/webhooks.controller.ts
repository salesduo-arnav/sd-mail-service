import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/errors';
import env from '../config/env';
import { Product } from '../models/product';
import { Message } from '../models/message';
import { addSuppression } from '../services/suppression.service';
import { normalizeEmail } from '../utils/email';
import {
    SnsMessage,
    verifySnsSignature,
    confirmSubscription,
    parseSesNotification,
    SesFeedback,
} from '../services/delivery/sns';
import { SuppressionReason } from '../types/workflow';
import Logger from '../utils/logger';

const feedbackStatus = (reason: SuppressionReason) => (reason === 'complaint' ? 'complained' : 'bounced');

// Flag the recent (last 7d) sent messages to an address with the feedback outcome —
// bounces/complaints reference a recent send, not the address's whole history.
async function markRecentMessages(productId: string, email: string, reason: SuppressionReason): Promise<void> {
    const since = new Date(Date.now() - 7 * 86_400_000);
    await Message.update(
        { status: feedbackStatus(reason) },
        {
            where: {
                product_id: productId,
                to_email: normalizeEmail(email),
                status: { [Op.in]: ['sent', 'delivered'] },
                created_at: { [Op.gte]: since },
            },
        },
    );
}

const schema = z.object({
    product_slug: z.string().min(1),
    email: z.string().email(),
    reason: z.enum(['hard_bounce', 'complaint']),
});

/**
 * POST /webhooks/email — ingest normalized bounce/complaint feedback (service-key auth).
 * A convenience/internal path that names the product directly; the real SES/SNS envelope
 * (signature-verified) is handled by postSesFeedback below.
 */
export const postEmailFeedback = asyncHandler(async (req: Request, res: Response) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid webhook payload', 'validation_error', parsed.error.flatten());
    const { product_slug, email, reason } = parsed.data;

    const product = await Product.findOne({ where: { slug: product_slug } });
    if (!product) throw notFound(`Unknown product "${product_slug}"`, 'product_not_found');

    await addSuppression(product.id, email, reason as SuppressionReason);
    await markRecentMessages(product.id, email, reason as SuppressionReason);

    Logger.info('email feedback ingested', { product: product_slug, email, reason });
    res.status(200).json({ ok: true });
});

// Suppress a bounced/complained address and flag its recent messages. Scope by the
// originating send (matched via SES message id), falling back to any product that
// recently mailed the address so a dead address is still suppressed everywhere.
async function suppressForFeedback(feedback: SesFeedback): Promise<void> {
    const since30d = new Date(Date.now() - 30 * 86_400_000);
    const matched = feedback.messageId
        ? await Message.findOne({ where: { provider_message_id: { [Op.like]: `%${feedback.messageId}%` } } })
        : null;

    for (const rawEmail of feedback.emails) {
        const email = normalizeEmail(rawEmail);
        const productIds = new Set<string>();
        // Prefer the originating product (matched by SES message id) so a complaint about
        // one product's mail doesn't suppress unrelated products. Only when we can't tie
        // the feedback to a specific send do we fall back to every product that recently
        // mailed the address (so a dead address is still suppressed).
        if (matched && matched.to_email === email) {
            productIds.add(matched.product_id);
        } else {
            const recent = await Message.findAll({
                where: { to_email: email, created_at: { [Op.gte]: since30d } },
                attributes: ['product_id'],
                group: ['product_id'],
            });
            recent.forEach((m) => productIds.add(m.product_id));
        }

        if (!productIds.size) {
            Logger.warn('SES feedback: no product for address — skipped', { email, reason: feedback.reason });
            continue;
        }
        for (const productId of productIds) {
            await addSuppression(productId, email, feedback.reason);
            await markRecentMessages(productId, email, feedback.reason);
        }
    }
}

/**
 * POST /webhooks/ses — Amazon SNS delivery of SES bounce/complaint notifications.
 * Authenticated by the SNS signature (not a service key), so it's mounted with a raw
 * text body. Confirms subscriptions and maps permanent bounces/complaints to
 * product-scoped suppressions.
 */
export const postSesFeedback = asyncHandler(async (req: Request, res: Response) => {
    let msg: SnsMessage;
    try {
        msg = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as SnsMessage;
    } catch {
        throw badRequest('Invalid SNS payload', 'invalid_sns_payload');
    }

    // The topic ARN is the only tenancy control on this endpoint — a valid SNS signature
    // just proves *some* AWS account signed the envelope, not that it's our topic. Without
    // an allowlisted ARN, a third party could subscribe our public endpoint to their own
    // topic and forge bounce/complaint suppressions (blocking a victim's mail). So require
    // a configured, matching ARN; boot-time env guard makes it mandatory in prod+SES.
    if (!env.SES_SNS_TOPIC_ARN || msg.TopicArn !== env.SES_SNS_TOPIC_ARN) {
        throw forbidden('Unexpected or unconfigured SNS topic', 'sns_topic_mismatch');
    }
    if (!(await verifySnsSignature(msg))) {
        throw forbidden('Invalid SNS signature', 'invalid_sns_signature');
    }

    if (msg.Type === 'SubscriptionConfirmation') {
        await confirmSubscription(msg);
        return res.status(200).json({ ok: true, confirmed: true });
    }
    if (msg.Type === 'UnsubscribeConfirmation') {
        Logger.info('SNS unsubscribe confirmation', { topic: msg.TopicArn });
        return res.status(200).json({ ok: true });
    }

    const feedback = parseSesNotification(msg.Message);
    if (feedback) {
        await suppressForFeedback(feedback);
        Logger.info('SES feedback processed', { reason: feedback.reason, count: feedback.emails.length });
    }
    res.status(200).json({ ok: true });
});
