import crypto from 'crypto';
import env from '../config/env';

const API_KEY_PREFIX = 'sdm_';

/** Generate a new plaintext product API key (shown once at creation). */
export function generateApiKey(): string {
    return API_KEY_PREFIX + crypto.randomBytes(24).toString('base64url');
}

/** Deterministic hash used to store/look up API keys (only the hash is persisted). */
export function hashApiKey(plaintext: string): string {
    return crypto.createHash('sha256').update(plaintext).digest('hex');
}

/** HMAC-SHA256 hex over a payload with a named secret (event signatures, tokens). */
export function hmacHex(payload: string, secret: string = env.HMAC_SECRET): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/** Constant-time compare of two hex strings. */
export function safeEqualHex(a: string, b: string): boolean {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
}
