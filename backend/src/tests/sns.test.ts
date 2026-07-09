import { isValidSigningCertUrl, canonicalString, parseSesNotification, SnsMessage } from '../services/delivery/sns';

describe('isValidSigningCertUrl', () => {
    it('accepts genuine SNS cert hosts', () => {
        expect(isValidSigningCertUrl('https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc.pem')).toBe(true);
        expect(isValidSigningCertUrl('https://sns.eu-west-1.amazonaws.com.cn/x.pem')).toBe(true);
    });
    it('rejects forged / non-SNS / non-https hosts', () => {
        expect(isValidSigningCertUrl('https://evil.com/cert.pem')).toBe(false);
        expect(isValidSigningCertUrl('https://sns.us-east-1.amazonaws.com.evil.com/x.pem')).toBe(false);
        expect(isValidSigningCertUrl('http://sns.us-east-1.amazonaws.com/x.pem')).toBe(false);
        expect(isValidSigningCertUrl('not a url')).toBe(false);
    });
});

describe('canonicalString', () => {
    it('builds the signed string for a Notification, skipping an absent Subject', () => {
        const msg = {
            Type: 'Notification',
            MessageId: 'm1',
            TopicArn: 'arn:topic',
            Message: 'hello',
            Timestamp: '2026-07-09T00:00:00.000Z',
        } as SnsMessage;
        expect(canonicalString(msg)).toBe(
            'Message\nhello\nMessageId\nm1\nTimestamp\n2026-07-09T00:00:00.000Z\nTopicArn\narn:topic\nType\nNotification\n',
        );
    });
    it('includes Subject when present and SubscribeURL/Token for confirmations', () => {
        const notif = { Type: 'Notification', MessageId: 'm', TopicArn: 't', Message: 'b', Timestamp: 'ts', Subject: 's' } as SnsMessage;
        expect(canonicalString(notif)).toContain('Subject\ns\n');
        const conf = {
            Type: 'SubscriptionConfirmation', MessageId: 'm', TopicArn: 't', Message: 'b', Timestamp: 'ts', Token: 'tok', SubscribeURL: 'https://x',
        } as SnsMessage;
        expect(canonicalString(conf)).toContain('SubscribeURL\nhttps://x\n');
        expect(canonicalString(conf)).toContain('Token\ntok\n');
    });
});

describe('parseSesNotification', () => {
    it('maps a permanent bounce to hard_bounce with recipients', () => {
        const raw = JSON.stringify({
            notificationType: 'Bounce',
            mail: { messageId: 'ses-123' },
            bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: 'a@x.com' }, { emailAddress: 'b@x.com' }] },
        });
        expect(parseSesNotification(raw)).toEqual({ reason: 'hard_bounce', emails: ['a@x.com', 'b@x.com'], messageId: 'ses-123' });
    });
    it('maps a complaint', () => {
        const raw = JSON.stringify({
            notificationType: 'Complaint',
            mail: { messageId: 'ses-9' },
            complaint: { complainedRecipients: [{ emailAddress: 'c@x.com' }] },
        });
        expect(parseSesNotification(raw)).toEqual({ reason: 'complaint', emails: ['c@x.com'], messageId: 'ses-9' });
    });
    it('ignores transient bounces, deliveries, and garbage', () => {
        expect(parseSesNotification(JSON.stringify({ notificationType: 'Bounce', bounce: { bounceType: 'Transient', bouncedRecipients: [{ emailAddress: 'a@x.com' }] } }))).toBeNull();
        expect(parseSesNotification(JSON.stringify({ notificationType: 'Delivery', mail: { messageId: 'x' } }))).toBeNull();
        expect(parseSesNotification('not json')).toBeNull();
    });
});
