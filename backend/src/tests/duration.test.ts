import { parseDuration, resolveFireAt, msUntil } from '../utils/duration';

describe('duration parsing', () => {
    it('parses relative units', () => {
        expect(parseDuration('1d')).toEqual({ kind: 'relative', ms: 86_400_000 });
        expect(parseDuration('48h')).toEqual({ kind: 'relative', ms: 172_800_000 });
        expect(parseDuration('30m')).toEqual({ kind: 'relative', ms: 1_800_000 });
        expect(parseDuration('3s')).toEqual({ kind: 'relative', ms: 3000 });
    });

    it('parses until:<field> as absolute', () => {
        expect(parseDuration('until:trial_ends_at')).toEqual({ kind: 'absolute', at: null, field: 'trial_ends_at' });
    });

    it('throws on garbage', () => {
        expect(() => parseDuration('soon')).toThrow();
    });
});

describe('resolveFireAt', () => {
    const now = new Date('2026-07-08T10:00:00Z');

    it('adds a relative delay to now', () => {
        expect(resolveFireAt('1d', now, {}).toISOString()).toBe('2026-07-09T10:00:00.000Z');
    });

    it('resolves until:<field> from data', () => {
        const at = resolveFireAt('until:trial_ends_at', now, { trial_ends_at: '2026-07-22T10:00:00Z' });
        expect(at.toISOString()).toBe('2026-07-22T10:00:00.000Z');
    });

    it('fires now when the until field is missing', () => {
        expect(resolveFireAt('until:missing', now, {}).getTime()).toBe(now.getTime());
    });

    it('fires now when the until field is in the past', () => {
        expect(resolveFireAt('until:t', now, { t: '2020-01-01T00:00:00Z' }).getTime()).toBe(now.getTime());
    });
});

describe('msUntil', () => {
    it('floors at zero for past times', () => {
        expect(msUntil(new Date('2000-01-01'), new Date('2026-01-01'))).toBe(0);
    });
    it('computes forward distance', () => {
        expect(msUntil(new Date('2026-01-01T00:00:03Z'), new Date('2026-01-01T00:00:00Z'))).toBe(3000);
    });
});
