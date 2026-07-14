import { Request, Response } from 'express';
import { asyncHandler } from '../utils/errors';
import { verifyUnsubscribeToken } from '../services/unsubscribe-token';
import { Subscriber } from '../models/subscriber';
import { setPreference } from '../services/preference.service';
import { addSuppression } from '../services/suppression.service';
import Logger from '../utils/logger';

function page(title: string, body: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f6f8;margin:0;padding:48px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;padding:32px;text-align:center;">
<h2 style="margin-top:0;">${title}</h2><p style="color:#4a4a4a;line-height:1.5;">${body}</p></div></body></html>`;
}

/** Confirmation page with a POST button — GET never changes state (see below). */
function confirmPage(token: string, category: string): string {
    const label = category ? `${category} emails` : 'these emails';
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f6f8;margin:0;padding:48px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;padding:32px;text-align:center;">
<h2 style="margin-top:0;">Unsubscribe</h2>
<p style="color:#4a4a4a;line-height:1.5;">Click below to stop receiving ${label}. You'll still get required account emails such as security codes.</p>
<form method="post" action="/u/${encodeURIComponent(token)}">
<button type="submit" style="background:#ff9900;color:#fff;border:0;border-radius:8px;padding:12px 24px;font-size:15px;cursor:pointer;">Unsubscribe</button>
</form></div></body></html>`;
}

/**
 * GET /u/:token — show a confirmation page. It deliberately does NOT change state, so a
 * mail-security link scanner / prefetcher that fetches the URL can't unsubscribe a user.
 * The actual unsubscribe happens on POST (button submit or RFC 8058 one-click).
 */
export const getUnsubscribe = asyncHandler(async (req: Request, res: Response) => {
    const payload = verifyUnsubscribeToken(req.params.token);
    if (!payload) {
        return res.status(400).send(page('Invalid link', 'This unsubscribe link is invalid or has expired.'));
    }
    return res.status(200).send(confirmPage(req.params.token, payload.category));
});

/**
 * POST /u/:token — perform the unsubscribe. Serves both the confirmation-page submit and
 * RFC 8058 one-click (List-Unsubscribe-Post). Flips the subscriber's preference for that
 * category and records an `unsubscribe` suppression — marketing only; transactional
 * sends bypass the unsubscribe reason.
 */
export const postUnsubscribe = asyncHandler(async (req: Request, res: Response) => {
    const payload = verifyUnsubscribeToken(req.params.token);
    if (!payload) {
        return res.status(400).send(page('Invalid link', 'This unsubscribe link is invalid or has expired.'));
    }

    const subscriber = await Subscriber.findByPk(payload.subscriber_id);
    if (!subscriber) {
        return res.status(404).send(page('Not found', 'We could not find your subscription.'));
    }

    if (payload.category) await setPreference(subscriber.id, payload.category, 'email', 'unsubscribed');
    if (subscriber.email) await addSuppression(payload.product_id, subscriber.email, 'unsubscribe');

    Logger.info('unsubscribed', { subscriber_id: subscriber.id, category: payload.category });
    return res
        .status(200)
        .send(
            page(
                'You’re unsubscribed',
                `You will no longer receive ${payload.category || 'these'} emails. You will still receive required account emails such as security codes.`,
            ),
        );
});
