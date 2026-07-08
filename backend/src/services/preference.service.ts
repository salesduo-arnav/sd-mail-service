import { SubscriberPreference } from '../models/subscriber_preference';
import { Channel } from '../types/workflow';

/**
 * Marketing preference check. A subscriber is opted out of a (category, channel)
 * only if an explicit `unsubscribed` row exists; absence defaults to subscribed.
 * Transactional mail never calls this — required mail is not preference-gated.
 */
export async function isOptedOut(subscriberId: string, category: string, channel: Channel): Promise<boolean> {
    const pref = await SubscriberPreference.findOne({
        where: { subscriber_id: subscriberId, category, channel },
    });
    return pref?.status === 'unsubscribed';
}

/** Set a subscriber's preference for a (category, channel). Upserts. */
export async function setPreference(
    subscriberId: string,
    category: string,
    channel: Channel,
    status: 'subscribed' | 'unsubscribed',
): Promise<void> {
    const [pref, created] = await SubscriberPreference.findOrCreate({
        where: { subscriber_id: subscriberId, category, channel },
        defaults: { subscriber_id: subscriberId, category, channel, status },
    });
    if (!created && pref.status !== status) await pref.update({ status });
}
