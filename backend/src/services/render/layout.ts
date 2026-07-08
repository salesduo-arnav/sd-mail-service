import { buildContext, RenderContextInput, renderString } from './liquid';

export interface CtaBlock {
    label: string;
    url: string;
}
export interface TemplateCta {
    primary?: CtaBlock;
    secondary?: CtaBlock;
}

export interface RenderTemplateInput extends RenderContextInput {
    subject: string;
    body: string; // Liquid + HTML (body only; layout wraps it)
    cta?: TemplateCta | null;
    layoutHtml?: string | null; // product.layout_html — must contain {{ content }}
    /** Marketing sends append this footer; transactional omit it. */
    unsubscribeUrl?: string | null;
    supportEmail?: string | null;
}

export interface RenderedEmail {
    subject: string;
    html: string;
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
    );
}

function buttonHtml(cta: CtaBlock, color: string, primary: boolean): string {
    const bg = primary ? color : '#ffffff';
    const fg = primary ? '#ffffff' : color;
    const border = primary ? color : `1px solid ${color}`;
    return `<a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:12px 22px;margin:6px 8px 6px 0;background:${bg};color:${fg};border:${border};border-radius:6px;text-decoration:none;font-weight:600;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(cta.label)}</a>`;
}

const DEFAULT_LAYOUT = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6f8;">
<div style="max-width:600px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.55;">
{{ content }}
</div></body></html>`;

/**
 * Render a template end-to-end: Liquid subject+body → CTA buttons → product layout
 * → optional marketing footer. Returns { subject, html }.
 */
export async function renderEmail(input: RenderTemplateInput): Promise<RenderedEmail> {
    const context = buildContext(input);
    const color = String(context.brand_color || '#ff9900');

    const subject = await renderString(input.subject, context);
    let body = await renderString(input.body, context);

    // CTA buttons (rendered with the same context so labels/urls can be Liquid).
    const buttons: string[] = [];
    if (input.cta?.primary?.url) {
        buttons.push(
            buttonHtml(
                { label: await renderString(input.cta.primary.label, context), url: await renderString(input.cta.primary.url, context) },
                color,
                true,
            ),
        );
    }
    if (input.cta?.secondary?.url) {
        buttons.push(
            buttonHtml(
                { label: await renderString(input.cta.secondary.label, context), url: await renderString(input.cta.secondary.url, context) },
                color,
                false,
            ),
        );
    }
    if (buttons.length) body += `<div style="margin-top:20px;">${buttons.join('')}</div>`;

    // Marketing footer (transactional passes no unsubscribeUrl → no footer).
    if (input.unsubscribeUrl) {
        const support = input.supportEmail ? `Questions? Contact ${escapeHtml(input.supportEmail)}.` : '';
        body += `<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e4e8;color:#8a8f98;font-size:12px;font-family:Arial,Helvetica,sans-serif;">
${support}<br/>You are receiving this because you have an account with ${escapeHtml(String(context.brand_name))}.
<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#8a8f98;">Unsubscribe</a>.
</div>`;
    }

    const layout = input.layoutHtml && input.layoutHtml.includes('{{ content }}') ? input.layoutHtml : DEFAULT_LAYOUT;
    const html = await renderString(layout, { ...context, content: body });

    return { subject, html };
}
