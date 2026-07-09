import crypto from 'crypto';
import Logger from '../../utils/logger';

// Amazon SNS message envelope (as delivered to an HTTPS subscription).
export interface SnsMessage {
    Type: 'SubscriptionConfirmation' | 'Notification' | 'UnsubscribeConfirmation';
    MessageId: string;
    TopicArn: string;
    Message: string;
    Timestamp: string;
    Signature: string;
    SignatureVersion: string;
    SigningCertURL: string;
    Subject?: string;
    Token?: string;
    SubscribeURL?: string;
}

// The fields (and order) SNS signs, per message type.
const SIGNED_KEYS: Record<string, string[]> = {
    Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
    SubscriptionConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
    UnsubscribeConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
};

// Only fetch signing certs from genuine SNS hosts (guards against SSRF / forged certs).
export function isValidSigningCertUrl(url: string): boolean {
    try {
        const u = new URL(url);
        return u.protocol === 'https:' && /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(u.hostname);
    } catch {
        return false;
    }
}

// Build the exact string SNS signed: `key\nvalue\n` for each signed key that is present.
export function canonicalString(msg: SnsMessage): string {
    const keys = SIGNED_KEYS[msg.Type];
    if (!keys) throw new Error(`unknown SNS message type: ${msg.Type}`);
    let out = '';
    for (const k of keys) {
        const v = (msg as unknown as Record<string, unknown>)[k];
        if (v === undefined || v === null) continue; // Subject is optional
        out += `${k}\n${String(v)}\n`;
    }
    return out;
}

const certCache = new Map<string, string>();

async function fetchCert(url: string): Promise<string> {
    const cached = certCache.get(url);
    if (cached) return cached;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`cert fetch failed: ${res.status}`);
    const pem = await res.text();
    certCache.set(url, pem);
    return pem;
}

// Verify an SNS message's signature against the AWS signing certificate.
export async function verifySnsSignature(msg: SnsMessage): Promise<boolean> {
    if (!isValidSigningCertUrl(msg.SigningCertURL)) {
        Logger.warn('SNS: rejected signing cert url', { url: msg.SigningCertURL });
        return false;
    }
    try {
        const algorithm = msg.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1';
        const pem = await fetchCert(msg.SigningCertURL);
        const verifier = crypto.createVerify(algorithm);
        verifier.update(canonicalString(msg), 'utf8');
        return verifier.verify(pem, msg.Signature, 'base64');
    } catch (err) {
        Logger.warn('SNS: signature verification error', { message: err instanceof Error ? err.message : String(err) });
        return false;
    }
}

// Confirm an HTTPS subscription by visiting the SubscribeURL SNS provided.
export async function confirmSubscription(msg: SnsMessage): Promise<void> {
    if (!msg.SubscribeURL) return;
    const res = await fetch(msg.SubscribeURL);
    if (!res.ok) throw new Error(`subscription confirm failed: ${res.status}`);
    Logger.info('SNS subscription confirmed', { topic: msg.TopicArn });
}

export type SesFeedback = { reason: 'hard_bounce' | 'complaint'; emails: string[]; messageId?: string };

// The inner SES event carried in SnsMessage.Message (a JSON string).
interface SesNotification {
    notificationType?: string;
    eventType?: string;
    mail?: { messageId?: string };
    bounce?: { bounceType?: string; bouncedRecipients?: { emailAddress: string }[] };
    complaint?: { complainedRecipients?: { emailAddress: string }[] };
}

// Parse an SES notification into a normalized feedback record. Returns null for
// events we don't suppress on (transient bounces, deliveries, etc.).
export function parseSesNotification(raw: string): SesFeedback | null {
    let n: SesNotification;
    try {
        n = JSON.parse(raw) as SesNotification;
    } catch {
        return null;
    }
    const kind = n.notificationType ?? n.eventType;
    const messageId = n.mail?.messageId;

    if (kind === 'Bounce' && n.bounce?.bounceType === 'Permanent') {
        const emails = (n.bounce.bouncedRecipients ?? []).map((r) => r.emailAddress).filter(Boolean);
        if (emails.length) return { reason: 'hard_bounce', emails, messageId };
    }
    if (kind === 'Complaint') {
        const emails = (n.complaint?.complainedRecipients ?? []).map((r) => r.emailAddress).filter(Boolean);
        if (emails.length) return { reason: 'complaint', emails, messageId };
    }
    return null;
}
