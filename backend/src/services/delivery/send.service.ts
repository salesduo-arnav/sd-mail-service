import { Message } from '../../models/message';
import { Product } from '../../models/product';
import { Subscriber } from '../../models/subscriber';
import { Template } from '../../models/template';
import { MessageStatus, MessageType, TemplateCtaJson } from '../../types/workflow';
import { renderEmail } from '../render/layout';
import { emailDriver } from './email-driver';
import { checkSuppression } from '../suppression.service';
import { isOptedOut } from '../preference.service';
import { unsubscribeUrl } from '../unsubscribe-token';
import Logger from '../../utils/logger';

/** The renderable content of a message — from a saved template or composed inline. */
export interface MessageContent {
    type: MessageType;
    subject: string | null;
    body: string | null;
    cta: TemplateCtaJson | null;
    templateId?: string | null;
}

export interface DeliverInput {
    product: Product;
    content: MessageContent;
    toEmail: string | null;
    subscriber?: Subscriber | null;
    /** Recipient display name when there is no subscriber (raw transactional sends). */
    toName?: string | null;
    data?: Record<string, unknown>;
    /** Marketing category (for preference gating + unsubscribe scope). */
    category?: string | null;
    runId?: string | null;
    runStepId?: string | null;
    campaignId?: string | null;
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
 * transactional API, the workflow engine, and marketing campaigns.
 *
 * Class-aware: transactional bypasses preferences + unsubscribe/complaint (blocked
 * only by hard_bounce, no footer); marketing honors preferences + all suppressions
 * and carries an unsubscribe footer.
 *
 * Idempotent per run_step (engine) or per (campaign, subscriber) (campaigns), so a
 * retried job never sends twice. Throws only on transient provider errors (enclosing
 * job retries); terminal outcomes return delivered=false.
 */
export async function deliver(input: DeliverInput): Promise<SendResult> {
    const { product, content, subscriber, runId, runStepId, campaignId } = input;
    const type = content.type;
    const toEmail = input.toEmail ?? subscriber?.email ?? null;

    const baseDefaults = {
        product_id: product.id,
        type,
        to_email: toEmail ?? '',
        subscriber_id: subscriber?.id ?? null,
        run_id: runId ?? null,
        run_step_id: runStepId ?? null,
        campaign_id: campaignId ?? null,
        template_id: content.templateId ?? null,
        channel: 'email' as const,
        status: 'queued' as MessageStatus,
    };

    // Idempotency anchor: one message per run_step, or per (campaign, subscriber).
    let message: Message;
    if (runStepId) {
        const [m, created] = await Message.findOrCreate({ where: { run_step_id: runStepId }, defaults: baseDefaults });
        message = m;
        if (!created && m.status === 'sent')
            return { messageId: m.id, status: 'sent', delivered: true, providerMessageId: m.provider_message_id ?? undefined };
    } else if (campaignId && subscriber) {
        const [m, created] = await Message.findOrCreate({
            where: { campaign_id: campaignId, subscriber_id: subscriber.id },
            defaults: baseDefaults,
        });
        message = m;
        if (!created && (m.status === 'sent' || m.status === 'suppressed'))
            return { messageId: m.id, status: m.status, delivered: m.status === 'sent', providerMessageId: m.provider_message_id ?? undefined };
    } else {
        message = await Message.create(baseDefaults);
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
        subject: content.subject ?? '',
        body: content.body ?? '',
        cta: content.cta,
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

export interface SendTemplateInput {
    product: Product;
    template: Template;
    toEmail: string | null;
    subscriber?: Subscriber | null;
    toName?: string | null;
    data?: Record<string, unknown>;
    category?: string | null;
    runId?: string | null;
    runStepId?: string | null;
}

/** Convenience wrapper: deliver a saved Template (used by the engine + transactional API). */
export async function sendTemplate(input: SendTemplateInput): Promise<SendResult> {
    return deliver({
        product: input.product,
        content: {
            type: input.template.type,
            subject: input.template.subject,
            body: input.template.body,
            cta: input.template.cta,
            templateId: input.template.id,
        },
        toEmail: input.toEmail,
        subscriber: input.subscriber,
        toName: input.toName,
        data: input.data,
        category: input.category,
        runId: input.runId,
        runStepId: input.runStepId,
    });
}
