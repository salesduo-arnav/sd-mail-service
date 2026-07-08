import { buildContext, renderString, validateLiquid } from '../services/render/liquid';
import { renderEmail } from '../services/render/layout';

describe('liquid context', () => {
    it('derives first_name from the subscriber name, defaulting to "there"', () => {
        expect(buildContext({ subscriber: { name: 'Jane Doe' } }).first_name).toBe('Jane');
        expect(buildContext({ subscriber: { name: '' } }).first_name).toBe('there');
        expect(buildContext({}).first_name).toBe('there');
    });

    it('exposes data both top-level and under data', async () => {
        const ctx = buildContext({ data: { upgrade_link: 'https://x' } });
        expect(await renderString('{{ upgrade_link }}|{{ data.upgrade_link }}', ctx)).toBe('https://x|https://x');
    });

    it('renders missing variables as empty (never throws)', async () => {
        expect(await renderString('Hi {{ nope }}!', buildContext({}))).toBe('Hi !');
    });
});

describe('validateLiquid', () => {
    it('accepts valid templates', async () => {
        expect(await validateLiquid('Hi {{ first_name }}')).toBeNull();
    });
    it('rejects malformed templates', async () => {
        expect(await validateLiquid('Hi {% if %}')).not.toBeNull();
    });
});

describe('renderEmail', () => {
    it('appends an unsubscribe footer only when a URL is provided (marketing)', async () => {
        const marketing = await renderEmail({
            subject: 'Hi',
            body: '<p>Body</p>',
            unsubscribeUrl: 'https://svc/u/tok',
            brand: { brand_name: 'Acme' },
        });
        expect(marketing.html).toContain('https://svc/u/tok');
        expect(marketing.html.toLowerCase()).toContain('unsubscribe');

        const transactional = await renderEmail({ subject: 'Hi', body: '<p>Body</p>', unsubscribeUrl: null });
        expect(transactional.html.toLowerCase()).not.toContain('unsubscribe');
    });

    it('renders CTA buttons from the cta block', async () => {
        const out = await renderEmail({
            subject: 'S',
            body: '<p>B</p>',
            cta: { primary: { label: 'Go', url: '{{ data.link }}' } },
            data: { link: 'https://go' },
        });
        expect(out.html).toContain('https://go');
        expect(out.html).toContain('Go');
    });
});
