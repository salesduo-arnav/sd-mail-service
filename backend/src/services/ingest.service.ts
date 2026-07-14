import { UniqueConstraintError } from 'sequelize';
import { z } from 'zod';
import { EventLog } from '../models/event_log';
import { Subscriber } from '../models/subscriber';
import { enqueueEvent } from '../queues';
import { normalizeEmail } from '../utils/email';
import Logger from '../utils/logger';

export interface SubscriberInput {
    external_id: string;
    email?: string | null;
    name?: string | null;
    attributes?: Record<string, unknown>;
    timezone?: string | null;
}

export interface EventInput {
    event_key: string;
    idempotency_key: string;
    occurred_at?: string;
    subscriber?: SubscriberInput;
    data?: Record<string, unknown>;
}

// Request-body schemas for the event contract (used by the /internal event endpoint).
export const MAX_DATA_BYTES = 32 * 1024;

const subscriberSchema = z.object({
    external_id: z.string().min(1),
    email: z.string().email().optional().nullable(),
    name: z.string().optional().nullable(),
    attributes: z.record(z.unknown()).optional(),
    timezone: z.string().optional().nullable(),
});

export const eventSchema = z.object({
    event_key: z.string().min(1),
    idempotency_key: z.string().min(1),
    occurred_at: z.string().datetime().optional(),
    subscriber: subscriberSchema.optional(),
    data: z.record(z.unknown()).optional(),
});

/**
 * Upsert a subscriber by (product_id, external_id). Merges attributes, refreshes
 * email/name when provided, and bumps last_seen_at. Producers may send a thin
 * subscriber (external_id only) after the first touch.
 */
export async function upsertSubscriber(
    productId: string,
    input: SubscriberInput,
    opts: { bumpLastSeen?: boolean } = {},
): Promise<Subscriber> {
    const now = new Date();
    const email = input.email != null ? normalizeEmail(input.email) : null;

    // findOrCreate avoids the read-then-create race: two concurrent first-touch
    // events for the same (product, external_id) can't both insert (the unique
    // index makes one a find). Sequelize handles the conflict internally.
    const [subscriber, created] = await Subscriber.findOrCreate({
        where: { product_id: productId, external_id: input.external_id },
        defaults: {
            product_id: productId,
            external_id: input.external_id,
            email,
            name: input.name ?? null,
            attributes: input.attributes ?? {},
            timezone: input.timezone ?? null,
            last_seen_at: opts.bumpLastSeen ? now : null,
        },
    });
    if (created) return subscriber;

    const patch: Partial<Subscriber> = {};
    if (email != null) patch.email = email;
    if (input.name != null) patch.name = input.name;
    if (input.timezone != null) patch.timezone = input.timezone;
    if (input.attributes && Object.keys(input.attributes).length) {
        patch.attributes = { ...subscriber.attributes, ...input.attributes };
    }
    if (opts.bumpLastSeen) patch.last_seen_at = now;
    if (Object.keys(patch).length) await subscriber.update(patch);
    return subscriber;
}

export interface IngestResult {
    id: string;
    deduped: boolean;
    subscriberId: string | null;
}

/**
 * Persist an event idempotently and enqueue it for processing. A duplicate
 * (product_id, idempotency_key) is a no-op returning the existing row.
 */
export async function ingestEvent(productId: string, input: EventInput): Promise<IngestResult> {
    let subscriberId: string | null = null;
    if (input.subscriber) {
        const sub = await upsertSubscriber(productId, input.subscriber, { bumpLastSeen: true });
        subscriberId = sub.id;
    }

    try {
        const row = await EventLog.create({
            product_id: productId,
            event_key: input.event_key,
            idempotency_key: input.idempotency_key,
            subscriber_id: subscriberId,
            occurred_at: input.occurred_at ? new Date(input.occurred_at) : null,
            data: input.data ?? {},
        });
        await enqueueEvent(row.id);
        return { id: row.id, deduped: false, subscriberId };
    } catch (err) {
        if (err instanceof UniqueConstraintError) {
            const existing = await EventLog.findOne({
                where: { product_id: productId, idempotency_key: input.idempotency_key },
            });
            // Re-enqueue on the dedup path too: if a prior attempt persisted the
            // event but failed to enqueue (e.g. a Redis blip), the producer's retry
            // lands here — enqueue is idempotent (jobId = event id), so this recovers
            // the event instead of leaving it stuck forever.
            if (existing) await enqueueEvent(existing.id);
            Logger.debug('event deduped', { product_id: productId, idempotency_key: input.idempotency_key });
            return { id: existing?.id ?? '', deduped: true, subscriberId: existing?.subscriber_id ?? subscriberId };
        }
        throw err;
    }
}
