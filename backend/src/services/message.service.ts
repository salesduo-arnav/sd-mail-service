import { z } from 'zod';
import { AppError, badRequest, notFound } from '../utils/errors';
import { Product } from '../models/product';
import { Template } from '../models/template';
import { Message } from '../models/message';
import { upsertSubscriber } from './ingest.service';
import { sendTemplate } from './delivery/send.service';
import redis from '../config/redis';
import Logger from '../utils/logger';

export const messageBodySchema = z.object({
    template_key: z.string().min(1),
    to: z.object({
        email: z.string().email(),
        name: z.string().optional().nullable(),
        external_id: z.string().optional().nullable(),
    }),
    data: z.record(z.unknown()).optional(),
    reply_to: z.string().email().optional(),
    idempotency_key: z.string().min(1).optional(),
});
export type MessageBody = z.infer<typeof messageBodySchema>;

const IDEMPOTENCY_TTL = 86_400; // 24h

/**
 * Send a transactional template message for `product` (used by /internal/messages).
 * Returns {status, body} for the success/replay paths; throws
 * AppError(422) when the address is undeliverable. Bypasses preferences + suppression
 * (blocked only by hard bounce); no unsubscribe footer.
 */
export async function sendTransactionalMessage(
    product: Product,
    body: MessageBody,
): Promise<{ status: number; body: Record<string, unknown> }> {
    // Optional idempotency: return the prior result for a repeated key (avoids double-OTP).
    const idemKey = body.idempotency_key ? `txn:${product.id}:${body.idempotency_key}` : null;
    if (idemKey) {
        const priorId = await redis.get(idemKey);
        if (priorId) {
            const prior = await Message.findByPk(priorId);
            if (prior) {
                return {
                    status: prior.status === 'sent' ? 200 : 422,
                    body: {
                        message_id: prior.id,
                        status: prior.status,
                        provider_message_id: prior.provider_message_id,
                        idempotent_replay: true,
                    },
                };
            }
        }
    }

    const template = await Template.findOne({ where: { product_id: product.id, key: body.template_key } });
    if (!template) throw notFound(`Template "${body.template_key}" not found`, 'template_not_found');
    if (template.type !== 'transactional') {
        throw badRequest(
            `Template "${body.template_key}" is not transactional; a transactional template is required`,
            'template_not_transactional',
        );
    }

    // Link/upsert the subscriber if external_id is provided; otherwise send to a raw email.
    let subscriber = null;
    if (body.to.external_id) {
        subscriber = await upsertSubscriber(product.id, {
            external_id: body.to.external_id,
            email: body.to.email,
            name: body.to.name ?? undefined,
        });
    }

    const result = await sendTemplate({
        product,
        template,
        toEmail: body.to.email,
        toName: body.to.name,
        subscriber,
        data: body.data ?? {},
        replyTo: body.reply_to,
    });

    if (idemKey) {
        await redis.set(idemKey, result.messageId, 'EX', IDEMPOTENCY_TTL, 'NX').catch(() => undefined);
    }

    if (result.delivered) {
        return {
            status: 200,
            body: {
                message_id: result.messageId,
                status: result.status,
                provider_message_id: result.providerMessageId,
            },
        };
    }

    // Not delivered — surface a failure the caller can show the user.
    Logger.warn('transactional send not delivered', { template: body.template_key, reason: result.reason });
    throw new AppError(422, `Message not delivered (${result.reason ?? 'undeliverable'})`, 'not_delivered', {
        message_id: result.messageId,
        status: result.status,
        reason: result.reason,
    });
}
