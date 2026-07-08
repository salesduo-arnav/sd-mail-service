import { Message } from '../../models/message';
import { Product } from '../../models/product';
import { Subscriber } from '../../models/subscriber';
import { Template } from '../../models/template';
import { MessageStatus } from '../../types/workflow';
import { renderEmail } from '../render/layout';
import { emailDriver } from './email-driver';
import { checkSuppression } from '../suppression.service';
import { isOptedOut } from '../preference.service';
import { unsubscribeUrl } from '../unsubscribe-token';
import Logger from '../../utils/logger';

export interface SendTemplateInput {
    product: Product;
    template: Template;
    toEmail: string | null;
    subscriber?: Subscriber | null;
    /** Recipient display name when there is no subscriber (raw transactional sends). */
    toName?: string | null;
    data?: Record<string, unknown>;
    /** Marketing category (for preference gating + unsubscribe scope). */
    category?: string | null;
    runId?: string | null;
    runStepId?: string | null;
}

export interface SendResult {
    messageId: string;
    status: MessageStatus;
    delivered: boolean;
    reason?: string;
    providerMessageId?: string;
}

/**
 * Render + gate + send one message, logging a `messages` row. Shared by the
 * transactional API (sync) and the workflow engine (immediate/delayed).
 *
 * Class-aware: transactional bypasses preferences + unsubscribe/complaint (blocked
 * only by hard_bounce, no footer); marketing honors preferences + all suppressions
 * and carries an unsubscribe footer. One message per run_step (idempotent redelivery).
 *
 * Throws only on transient provider errors (so the enclosing job retries); terminal
 * outcomes (suppressed, hard-bounce, no-recipient) return a result with delivered=false.
 */
export async function sendTemplate(input: SendTemplateInput): Promise<SendResult> {
    const { product, template, subscriber, runId, runStepId } = input;
    const type = template.type;
    const toEmail = input.toEmail ?? subscriber?.email ?? null;

    // Idempotency: at most one message per run_step.
    let message: Message;
    if (runStepId) {
        const [m, created] = await Message.findOrCreate({
            where: { run_step_id: runStepId },
            defaults: {
                product_id: product.id,
                type,
                to_email: toEmail ?? '',
                subscriber_id: subscriber?.id ?? null,
                run_id: runId ?? null,
                run_step_id: runStepId,
                template_id: template.id,
                channel: 'email',
                status: 'queued',
            },
        });
        message = m;
        if (!created && m.status === 'sent') {
            return { messageId: m.id, status: 'sent', delivered: true, providerMessageId: m.provider_message_id ?? undefined };
        }
    } else {
        message = await Message.create({
            product_id: product.id,
            type,
            to_email: toEmail ?? '',
            subscriber_id: subscriber?.id ?? null,
            run_id: runId ?? null,
            template_id: template.id,
            channel: 'email',
            status: 'queued',
        });
    }

    const finalize = async (status: MessageStatus, patch: Partial<Message> = {}) => {
        await message.update({ status, ...patch });
    };

    if (!toEmail) {
        await finalize('failed', { error: 'no recipient email' });
        return { messageId: message.id, status: 'failed', delivered: false, reason: 'no_recipient' };
    }

    // Suppression (class-aware).
    const supp = await checkSuppression(product.id, toEmail, type);
    if (supp.blocked) {
        await finalize('suppressed', { error: `suppressed:${supp.reason}` });
        Logger.info('send suppressed', { to: toEmail, type, reason: supp.reason });
        return { messageId: message.id, status: 'suppressed', delivered: false, reason: supp.reason };
    }

    // Preferences (marketing only).
    if (type === 'marketing' && subscriber && input.category) {
        if (await isOptedOut(subscriber.id, input.category, 'email')) {
            await finalize('suppressed', { error: 'opted_out' });
            Logger.info('send suppressed (opted out)', { to: toEmail, category: input.category });
            return { messageId: message.id, status: 'suppressed', delivered: false, reason: 'opted_out' };
        }
    }

    // Render (marketing appends an unsubscribe footer; transactional never does).
    const unsub =
        type === 'marketing' && subscriber
            ? unsubscribeUrl({ subscriber_id: subscriber.id, category: input.category ?? '', product_id: product.id })
            : null;

    const rendered = await renderEmail({
        subject: template.subject ?? '',
        body: template.body ?? '',
        cta: template.cta,
        subscriber: subscriber
            ? { name: subscriber.name, email: subscriber.email, attributes: subscriber.attributes }
            : { name: input.toName ?? null, email: toEmail },
        data: input.data ?? {},
        brand: product,
        layoutHtml: product.layout_html,
        unsubscribeUrl: unsub,
        supportEmail: product.reply_to_email,
    });

    // Deliver. Provider errors bubble up so the enclosing job retries.
    const res = await emailDriver().send({
        from: product.from_email,
        to: toEmail,
        replyTo: product.reply_to_email ?? undefined,
        subject: rendered.subject,
        html: rendered.html,
        headers: unsub ? { 'List-Unsubscribe': `<${unsub}>` } : undefined,
    });

    await finalize('sent', {
        to_email: toEmail,
        provider_message_id: res.providerMessageId ?? null,
        sent_at: new Date(),
        error: null,
    });
    return { messageId: message.id, status: 'sent', delivered: true, providerMessageId: res.providerMessageId };
}
