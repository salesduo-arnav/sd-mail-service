import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { asyncHandler, badRequest, notFound } from '../utils/errors';
import { Product } from '../models/product';
import { Message } from '../models/message';
import { addSuppression } from '../services/suppression.service';
import { SuppressionReason } from '../types/workflow';
import Logger from '../utils/logger';

const schema = z.object({
    product_slug: z.string().min(1),
    email: z.string().email(),
    reason: z.enum(['hard_bounce', 'complaint']),
});

/**
 * POST /webhooks/email — ingest bounce/complaint feedback (service-key auth).
 * Adds a reason-scoped suppression and marks recent messages accordingly.
 *
 * v1 accepts a normalized payload; an SES/SNS envelope parser can be layered on top
 * later, translating SNS notifications into this shape.
 */
export const postEmailFeedback = asyncHandler(async (req: Request, res: Response) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid webhook payload', 'validation_error', parsed.error.flatten());
    const { product_slug, email, reason } = parsed.data;

    const product = await Product.findOne({ where: { slug: product_slug } });
    if (!product) throw notFound(`Unknown product "${product_slug}"`, 'product_not_found');

    await addSuppression(product.id, email, reason as SuppressionReason);

    // Mark recent (last 7d) messages to this address with the feedback status —
    // bounces/complaints reference a recent send, not the address's whole history.
    const status = reason === 'hard_bounce' ? 'bounced' : 'complained';
    const since = new Date(Date.now() - 7 * 86_400_000);
    await Message.update(
        { status },
        {
            where: {
                product_id: product.id,
                to_email: email,
                status: { [Op.in]: ['sent', 'delivered'] },
                created_at: { [Op.gte]: since },
            },
        },
    );

    Logger.info('email feedback ingested', { product: product_slug, email, reason });
    res.status(200).json({ ok: true });
});
