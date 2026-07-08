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

    let total = 0;
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
        total += subs.length;
        offset += subs.length;
        if (subs.length < PAGE) break;
    }

    await campaign.update({ status: 'sending', total_recipients: total });
    Logger.info('campaign dispatched', { campaign: campaign.id, recipients: total });
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
export async function sendCampaignToSubscriber(campaignId: string, subscriberId: string): Promise<void> {
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) return;
    const [product, subscriber] = await Promise.all([
        Product.findByPk(campaign.product_id),
        Subscriber.findByPk(subscriberId),
    ]);
    if (!product || !subscriber || !subscriber.email) return;

    const content = await contentFor(campaign);
    if (!content) {
        Logger.error('campaign has no template/content — skipping recipient', { campaign: campaignId });
        return;
    }

    await deliver({
        product,
        content,
        toEmail: subscriber.email,
        subscriber,
        category: campaign.category,
        campaignId: campaign.id,
    });
}
