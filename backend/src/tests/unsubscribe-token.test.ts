import { signUnsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl } from '../services/unsubscribe-token';

describe('unsubscribe tokens', () => {
    const payload = { subscriber_id: 'sub_1', category: 'reengagement', product_id: 'prod_1' };

    it('round-trips a signed token', () => {
        const token = signUnsubscribeToken(payload);
        expect(verifyUnsubscribeToken(token)).toMatchObject(payload);
    });

    it('rejects a tampered token', () => {
        const token = signUnsubscribeToken(payload);
        expect(verifyUnsubscribeToken(token + 'x')).toBeNull();
        expect(verifyUnsubscribeToken('not-a-token')).toBeNull();
    });

    it('builds a public unsubscribe URL', () => {
        expect(unsubscribeUrl(payload)).toMatch(/\/u\/[\w.-]+$/);
    });
});
