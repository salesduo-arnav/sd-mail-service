import { EventLog } from '../../models/event_log';
import { Product } from '../../models/product';
import { Subscriber } from '../../models/subscriber';
import { withLock } from '../../config/redis';
import { matchAndStart } from './trigger-matcher';
import { cancelRunsForEvent } from './cancel.service';
import Logger from '../../utils/logger';

/**
 * Process one ingested event: start runs for matching workflows, then cancel any
 * active runs this event defuses (schedule-and-cancel). The new run started by this
 * same event is excluded from cancellation.
 */
export async function processEvent(eventLogId: string): Promise<void> {
    const event = await EventLog.findByPk(eventLogId);
    if (!event) {
        Logger.warn('processEvent: event not found', { eventLogId });
        return;
    }
    const product = await Product.findByPk(event.product_id);
    if (!product) return;

    const subscriber = event.subscriber_id ? await Subscriber.findByPk(event.subscriber_id) : null;
    if (!subscriber) {
        Logger.info('processEvent: event has no subscriber — no workflows started', {
            eventLogId,
            event_key: event.event_key,
        });
        return;
    }

    // Serialize per subscriber so two concurrent events can't both create a run
    // (double-fire) or race the subscriber upsert. Same-subscriber events are
    // effectively processed one at a time; cross-subscriber stays fully parallel.
    await withLock(`sdmail:lock:sub:${subscriber.id}`, async () => {
        const started = await matchAndStart(product, event, subscriber);
        const canceled = await cancelRunsForEvent(subscriber.id, event.event_key, event.id);
        Logger.info('processEvent handled', { event_key: event.event_key, started, canceled });
    });
}
