import { Request, Response } from 'express';
import { Op, fn, col } from 'sequelize';
import { z } from 'zod';
import { asyncHandler, badRequest, notFound } from '../../utils/errors';
import { Campaign } from '../../models/campaign';
import { Message } from '../../models/message';
import { Subscriber } from '../../models/subscriber';
import { Template } from '../../models/template';
import { enqueueCampaignDispatch } from '../../queues';

const TERMINAL = ['sent', 'suppressed', 'failed', 'bounced', 'complained'];

/** Live per-status message counts for a set of campaigns (source of truth = messages). */
async function countsFor(campaignIds: string[]): Promise<Record<string, Record<string, number>>> {
    if (!campaignIds.length) return {};
    const rows = (await Message.findAll({
        attributes: ['campaign_id', 'status', [fn('COUNT', col('id')), 'n']],
        where: { campaign_id: { [Op.in]: campaignIds } },
        group: ['campaign_id', 'status'],
        raw: true,
    })) as unknown as Array<{ campaign_id: string; status: string; n: string }>;
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) {
        (out[r.campaign_id] ??= {})[r.status] = Number(r.n);
    }
    return out;
}

const summarize = (byStatus: Record<string, number> = {}) => {
    const sent = byStatus.sent ?? 0;
    const suppressed = byStatus.suppressed ?? 0;
    const failed = (byStatus.failed ?? 0) + (byStatus.bounced ?? 0) + (byStatus.complained ?? 0);
    const processed = TERMINAL.reduce((a, s) => a + (byStatus[s] ?? 0), 0);
    return { sent, suppressed, failed, processed };
};

/** Lazily flip a fully-processed campaign to its terminal status + snapshot counts. */
async function maybeFinalize(campaign: Campaign, c: ReturnType<typeof summarize>): Promise<void> {
    if (campaign.status === 'sending' && campaign.total_recipients > 0 && c.processed >= campaign.total_recipients) {
        const status = c.sent === 0 && c.failed > 0 ? 'failed' : 'sent';
        await campaign.update({
            status,
            completed_at: new Date(),
            sent_count: c.sent,
            suppressed_count: c.suppressed,
            failed_count: c.failed,
        });
    }
}

export const listCampaigns = asyncHandler(async (req: Request, res: Response) => {
    const where: Record<string, unknown> = {};
    if (req.query.product_id) where.product_id = req.query.product_id;
    const campaigns = await Campaign.findAll({ where, order: [['created_at', 'DESC']], limit: 100 });
    const counts = await countsFor(campaigns.map((c) => c.id));
    for (const c of campaigns) await maybeFinalize(c, summarize(counts[c.id]));
    res.json(campaigns.map((c) => ({ ...c.toJSON(), counts: summarize(counts[c.id]) })));
});

export const getCampaign = asyncHandler(async (req: Request, res: Response) => {
    const campaign = await Campaign.findByPk(req.params.id);
    if (!campaign) throw notFound('Campaign not found');
    const counts = summarize((await countsFor([campaign.id]))[campaign.id]);
    await maybeFinalize(campaign, counts);
    res.json({ ...campaign.toJSON(), counts });
});

/** Recipient count for a product's audience (subscribers with an email). */
export const audienceCount = asyncHandler(async (req: Request, res: Response) => {
    if (!req.query.product_id) throw badRequest('product_id required', 'validation_error');
    const count = await Subscriber.count({
        where: { product_id: String(req.query.product_id), email: { [Op.ne]: null } },
    });
    res.json({ count });
});

const ctaSchema = z
    .object({
        primary: z.object({ label: z.string(), url: z.string() }).optional(),
        secondary: z.object({ label: z.string(), url: z.string() }).optional(),
    })
    .nullable()
    .optional();

const createSchema = z
    .object({
        product_id: z.string().uuid(),
        name: z.string().min(1),
        category: z.string().default('marketing'),
        template_id: z.string().uuid().nullable().optional(),
        subject: z.string().nullable().optional(),
        body: z.string().nullable().optional(),
        cta: ctaSchema,
    })
    .refine((d) => !!d.template_id || (!!d.subject && !!d.body), {
        message: 'Provide a template_id, or a subject and body',
    });

/** Create + immediately dispatch a marketing campaign to all subscribers with an email. */
export const createCampaign = asyncHandler(async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid campaign', 'validation_error', parsed.error.flatten());
    const d = parsed.data;

    if (d.template_id) {
        const t = await Template.findOne({ where: { id: d.template_id, product_id: d.product_id } });
        if (!t) throw badRequest('template not found for this product', 'invalid_template');
    }

    const campaign = await Campaign.create({
        product_id: d.product_id,
        name: d.name,
        category: d.category,
        template_id: d.template_id ?? null,
        subject: d.subject ?? null,
        body: d.body ?? null,
        cta: d.cta ?? null,
        audience: { all: true },
        status: 'queued',
        created_by: req.admin?.admin_id ?? null,
    });
    await enqueueCampaignDispatch(campaign.id);
    res.status(201).json(campaign);
});

/** Re-dispatch a campaign (retry not-yet-sent recipients). Idempotent per (campaign,
 *  subscriber), so already-sent recipients are skipped — useful after fixing SMTP. */
export const resendCampaign = asyncHandler(async (req: Request, res: Response) => {
    const campaign = await Campaign.findByPk(req.params.id);
    if (!campaign) throw notFound('Campaign not found');
    await campaign.update({ status: 'queued', completed_at: null });
    await enqueueCampaignDispatch(campaign.id);
    res.json({ ok: true });
});
