import nodemailer, { Transporter } from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';
import * as aws from '@aws-sdk/client-ses';
import env from '../../config/env';
import Logger from '../../utils/logger';

export interface SendEmailInput {
    from: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
    headers?: Record<string, string>;
}

export interface SendEmailResult {
    providerMessageId?: string;
    accepted: boolean;
}

/**
 * Email channel driver. Wraps nodemailer over SMTP (dev: Mailhog) or Amazon SES.
 * Per-product `from`/`replyTo` are passed in by the caller.
 */
export class EmailDriver {
    private transporter: Transporter;

    constructor() {
        if (env.EMAIL_TRANSPORT === 'ses') {
            // The SES client is only instantiated (needing AWS creds) when this branch runs.
            const ses = new aws.SESClient({ region: env.SES_REGION });
            this.transporter = nodemailer.createTransport({ SES: { ses, aws } });
        } else {
            this.transporter = nodemailer.createTransport({
                host: env.SMTP_HOST,
                port: env.SMTP_PORT,
                secure: env.SMTP_PORT === 465,
                auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
            });
        }
    }

    async send(input: SendEmailInput): Promise<SendEmailResult> {
        const opts: SendMailOptions = {
            from: input.from,
            to: input.to,
            subject: input.subject,
            html: input.html,
            text: input.text,
            replyTo: input.replyTo,
            headers: input.headers,
        };
        const info = await this.transporter.sendMail(opts);
        const accepted = !info.rejected || info.rejected.length === 0;
        Logger.debug('email sent', { to: input.to, subject: input.subject, id: info.messageId, accepted });
        return { providerMessageId: info.messageId, accepted };
    }
}

let singleton: EmailDriver | null = null;
export function emailDriver(): EmailDriver {
    if (!singleton) singleton = new EmailDriver();
    return singleton;
}
