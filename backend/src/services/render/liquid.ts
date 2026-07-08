import { Liquid } from 'liquidjs';

/**
 * LiquidJS is designed for untrusted, admin-authored templates: safe by default,
 * light logic ({% if %}, filters, defaults). Missing variables render as empty
 * strings (strictVariables:false) so a template never crashes a send.
 */
export const liquid = new Liquid({
    strictVariables: false,
    strictFilters: false,
    jsTruthy: true,
});

export interface RenderContextInput {
    subscriber?: { name?: string | null; email?: string | null; attributes?: Record<string, unknown> } | null;
    data?: Record<string, unknown>;
    brand?: { brand_name?: string | null; brand_color?: string | null; logo_url?: string | null };
}

/** Build the template context. `data` fields are exposed both top-level and under `data.*`. */
export function buildContext(input: RenderContextInput): Record<string, unknown> {
    const data = input.data ?? {};
    const name = input.subscriber?.name ?? '';
    const first_name = (name.trim().split(/\s+/)[0] || 'there').trim();
    return {
        ...data,
        data,
        subscriber: input.subscriber ?? {},
        attributes: input.subscriber?.attributes ?? {},
        first_name,
        brand_name: input.brand?.brand_name ?? 'SalesDuo',
        brand_color: input.brand?.brand_color ?? '#ff9900',
        logo_url: input.brand?.logo_url ?? '',
    };
}

/** Render a Liquid string against a context. Errors bubble to the caller (per-message failure). */
export async function renderString(template: string, context: Record<string, unknown>): Promise<string> {
    return liquid.parseAndRender(template, context);
}

/** Validate a Liquid template at save time; returns an error message or null. */
export async function validateLiquid(template: string): Promise<string | null> {
    try {
        liquid.parse(template);
        return null;
    } catch (err) {
        return err instanceof Error ? err.message : 'Invalid Liquid template';
    }
}
