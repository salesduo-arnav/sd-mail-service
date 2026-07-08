import jwt from 'jsonwebtoken';
import env from '../config/env';

export interface UnsubscribePayload {
    subscriber_id: string;
    category: string;
    product_id: string;
}

/** Sign a scoped, expiring unsubscribe token (HMAC via JWT). */
export function signUnsubscribeToken(payload: UnsubscribePayload, expiresIn: string = '365d'): string {
    return jwt.sign(payload, env.UNSUB_SECRET, { expiresIn } as jwt.SignOptions);
}

/** Verify + decode an unsubscribe token; returns null if tampered/expired. */
export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
    try {
        return jwt.verify(token, env.UNSUB_SECRET) as UnsubscribePayload;
    } catch {
        return null;
    }
}

/** Build the public unsubscribe URL for a marketing send. */
export function unsubscribeUrl(payload: UnsubscribePayload): string {
    const token = signUnsubscribeToken(payload);
    return `${env.PUBLIC_URL}/u/${token}`;
}
