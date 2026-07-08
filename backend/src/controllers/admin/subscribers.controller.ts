import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { asyncHandler, badRequest, notFound } from '../../utils/errors';
import { Subscriber } from '../../models/subscriber';
import { SubscriberPreference } from '../../models/subscriber_preference';
import { Message } from '../../models/message';
import { Suppression } from '../../models/suppression';
import { addSuppression, removeSuppression } from '../../services/suppression.service';
import { setPreference } from '../../services/preference.service';

export const searchSubscribers = asyncHandler(async (req: Request, res: Response) => {
    const q = String(req.query.q ?? '').trim();
    const where: Record<string, unknown> = {};
    if (req.query.product_id) where.product_id = req.query.product_id;
    if (q) {
        Object.assign(where, {
            [Op.or]: [{ external_id: { [Op.iLike]: `%${q}%` } }, { email: { [Op.iLike]: `%${q}%` } }],
        });
    }
    const subscribers = await Subscriber.findAll({ where, order: [['updated_at', 'DESC']], limit: 50 });
    res.json(subscribers);
});

export const getSubscriber = asyncHandler(async (req: Request, res: Response) => {
    const subscriber = await Subscriber.findByPk(req.params.id);
    if (!subscriber) throw notFound('Subscriber not found');
    const preferences = await SubscriberPreference.findAll({ where: { subscriber_id: subscriber.id } });
    const messages = await Message.findAll({
        where: { subscriber_id: subscriber.id },
        order: [['created_at', 'DESC']],
        limit: 50,
    });
    const suppressions = subscriber.email
        ? await Suppression.findAll({ where: { product_id: subscriber.product_id, email: subscriber.email } })
        : [];
    res.json({ subscriber, preferences, messages, suppressions });
});

const prefSchema = z.object({
    category: z.string().min(1),
    channel: z.enum(['email', 'slack', 'in_app', 'sms']).default('email'),
    status: z.enum(['subscribed', 'unsubscribed']),
});

/** Set a subscriber's marketing preference for a (category, channel). */
export const setSubscriberPreference = asyncHandler(async (req: Request, res: Response) => {
    const subscriber = await Subscriber.findByPk(req.params.id);
    if (!subscriber) throw notFound('Subscriber not found');
    const parsed = prefSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('category, channel, status required', 'validation_error');
    await setPreference(subscriber.id, parsed.data.category, parsed.data.channel, parsed.data.status);
    const preferences = await SubscriberPreference.findAll({ where: { subscriber_id: subscriber.id } });
    res.json({ ok: true, preferences });
});

const suppressSchema = z.object({
    email: z.string().email(),
    reason: z.enum(['hard_bounce', 'complaint', 'unsubscribe', 'manual']).default('manual'),
});

export const suppress = asyncHandler(async (req: Request, res: Response) => {
    const parsed = suppressSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('email + reason required', 'validation_error');
    if (!req.query.product_id) throw badRequest('product_id query required', 'validation_error');
    await addSuppression(String(req.query.product_id), parsed.data.email, parsed.data.reason);
    res.json({ ok: true });
});

export const unsuppress = asyncHandler(async (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '');
    if (!email || !req.query.product_id) throw badRequest('product_id + email required', 'validation_error');
    const removed = await removeSuppression(String(req.query.product_id), email, req.body?.reason);
    res.json({ ok: true, removed });
});
