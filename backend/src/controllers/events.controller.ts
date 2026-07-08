import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest } from '../utils/errors';
import { ingestEvent, upsertSubscriber } from '../services/ingest.service';

const MAX_DATA_BYTES = 32 * 1024;

const subscriberSchema = z.object({
    external_id: z.string().min(1),
    email: z.string().email().optional().nullable(),
    name: z.string().optional().nullable(),
    attributes: z.record(z.unknown()).optional(),
    timezone: z.string().optional().nullable(),
});

const eventSchema = z.object({
    event_key: z.string().min(1),
    idempotency_key: z.string().min(1),
    occurred_at: z.string().datetime().optional(),
    subscriber: subscriberSchema.optional(),
    data: z.record(z.unknown()).optional(),
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
    const result = schema.safeParse(body);
    if (!result.success) {
        throw badRequest('Invalid request body', 'validation_error', result.error.flatten());
    }
    return result.data;
}

/** POST /v1/events — async ingest. Returns 202 (fire-and-forget for producers). */
export const postEvent = asyncHandler(async (req: Request, res: Response) => {
    const body = parse(eventSchema, req.body);
    if (body.data && JSON.stringify(body.data).length > MAX_DATA_BYTES) {
        throw badRequest('data payload too large (max 32KB)', 'payload_too_large');
    }
    const result = await ingestEvent(req.product!.id, body);
    res.status(202).json({ id: result.id, deduped: result.deduped, subscriber_id: result.subscriberId });
});

/** POST /v1/subscribers — identify/update a profile without triggering a workflow. */
export const postSubscriber = asyncHandler(async (req: Request, res: Response) => {
    const body = parse(subscriberSchema, req.body);
    const sub = await upsertSubscriber(req.product!.id, body, { bumpLastSeen: false });
    res.status(200).json({ id: sub.id, external_id: sub.external_id });
});

const activitySchema = z.object({ external_id: z.string().min(1) });

/** POST /v1/events/activity — thin ping that bumps last_seen_at (drives inactivity). */
export const postActivity = asyncHandler(async (req: Request, res: Response) => {
    const body = parse(activitySchema, req.body);
    const sub = await upsertSubscriber(req.product!.id, { external_id: body.external_id }, { bumpLastSeen: true });
    res.status(202).json({ id: sub.id, last_seen_at: sub.last_seen_at });
});
