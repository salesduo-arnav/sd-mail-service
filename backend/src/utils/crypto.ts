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

// AES-256 key derived (domain-separated) from the app secret, so an encrypted
// key blob in the DB is useless without the running app's secret.
const AES_KEY = crypto.createHash('sha256').update('sdmail:apikey:' + env.ADMIN_SESSION_SECRET).digest();

/** Encrypt a secret for at-rest storage (AES-256-GCM). Returns base64(iv|tag|ciphertext). */
export function encryptSecret(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}

/** Decrypt a value produced by encryptSecret. Throws if tampered or the secret changed. */
export function decryptSecret(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
