import { Op } from 'sequelize';
import { Campaign } from '../models/campaign';
import { Subscriber } from '../models/subscriber';
import { Product } from '../models/product';
import { Template } from '../models/template';
import { deliver, MessageContent } from './delivery/send.service';
import { enqueueCampaignSend } from '../queues';
import Logger from '../utils/logger';

const PAGE = 1000;

/**
 * Fan out a campaign: count recipients (subscribers of the product with an email) and
 * enqueue one idempotent send job per recipient. Re-running is safe — enqueue dedups
 * by jobId and per-recipient delivery dedups on (campaign, subscriber).
 */
export async function dispatchCampaign(campaignId: string): Promise<void> {
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) return;
    if (campaign.status === 'sent' || campaign.status === 'failed') return;

    // Fail fast if there's nothing to render (e.g. the chosen template was deleted) —
    // otherwise every recipient job would skip with no message row and the campaign would
    // hang in 'sending' forever (finalize waits for processed >= total_recipients).
    if (!(await contentFor(campaign))) {
        await campaign.update({ status: 'failed', completed_at: new Date() });
        Logger.error('campaign has no template/content — marked failed', { campaign: campaignId });
        return;
    }

    // Set total_recipients up front (before enqueuing) so a fast worker's skip-decrement
    // can't be clobbered by a later total write.
    const total = await Subscriber.count({
        where: { product_id: campaign.product_id, email: { [Op.ne]: null } },
    });
    await campaign.update({ status: 'sending', total_recipients: total });

    let offset = 0;
    for (;;) {
        const subs = await Subscriber.findAll({
            where: { product_id: campaign.product_id, email: { [Op.ne]: null } },
            attributes: ['id'],
            order: [['id', 'ASC']],
            limit: PAGE,
            offset,
        });
        if (!subs.length) break;
        for (const s of subs) await enqueueCampaignSend(campaign.id, s.id);
        offset += subs.length;
        if (subs.length < PAGE) break;
    }

    Logger.info('campaign dispatched', { campaign: campaign.id, recipients: total });
}

/** A recipient that can't produce a message (deleted subscriber / no email / no content)
 *  must not leave the campaign hanging — drop it from the expected total so finalize can
 *  still complete. Atomic + best-effort. */
async function dropRecipient(campaignId: string): Promise<void> {
    await Campaign.decrement('total_recipients', { where: { id: campaignId } }).catch(() => undefined);
}

async function contentFor(campaign: Campaign): Promise<MessageContent | null> {
    // Campaigns are always marketing — force the class so suppression/preferences +
    // the unsubscribe footer always apply, even if a chosen template is transactional.
    if (campaign.template_id) {
        const t = await Template.findByPk(campaign.template_id);
        if (!t) return null;
        return { type: 'marketing', subject: t.subject, body: t.body, cta: t.cta, templateId: t.id };
    }
    return { type: 'marketing', subject: campaign.subject, body: campaign.body, cta: campaign.cta, templateId: null };
}

/**
 * Send one campaign recipient. Marketing gate applies (suppression + preferences +
 * unsubscribe footer). Idempotent per (campaign, subscriber) via deliver().
 */
export async function sendCampaignToSubscriber(
    campaignId: string,
    subscriberId: string,
    finalAttempt = false,
): Promise<void> {
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) return;
    const [product, subscriber] = await Promise.all([
        Product.findByPk(campaign.product_id),
        Subscriber.findByPk(subscriberId),
    ]);
    if (!product || !subscriber || !subscriber.email) {
        await dropRecipient(campaignId);
        return;
    }

    const content = await contentFor(campaign);
    if (!content) {
        Logger.error('campaign has no template/content — skipping recipient', { campaign: campaignId });
        await dropRecipient(campaignId);
        return;
    }

    await deliver({
        product,
        content,
        toEmail: subscriber.email,
        subscriber,
        category: campaign.category,
        campaignId: campaign.id,
        finalAttempt,
    });
}
