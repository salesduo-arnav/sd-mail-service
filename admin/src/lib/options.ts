import type { Audience, MessageType, SuppressionReason } from '@/types';

// A selectable option with a human label and an optional one-line description.
export interface Option<T extends string = string> {
    value: T;
    label: string;
    description?: string;
}

export const MESSAGE_TYPE_OPTIONS: Option<MessageType>[] = [
    { value: 'marketing', label: 'Marketing', description: 'Honors opt-outs and adds an unsubscribe footer.' },
    { value: 'transactional', label: 'Transactional', description: 'Always delivered (OTP, receipts); no footer.' },
];

export const AUDIENCE_OPTIONS: Option<Audience>[] = [
    { value: 'event_subscriber', label: 'Event subscriber', description: 'The person the event is about.' },
    { value: 'org_owner', label: 'Organization owner', description: "Sends to the subscriber's attributes.org_owner_email, else the subscriber." },
];

export const SUPPRESSION_REASON_OPTIONS: Option<SuppressionReason>[] = [
    { value: 'manual', label: 'Manual', description: 'Added by an admin.' },
    { value: 'hard_bounce', label: 'Hard bounce', description: 'The address rejected mail permanently.' },
    { value: 'complaint', label: 'Spam complaint', description: 'The recipient marked mail as spam.' },
    { value: 'unsubscribe', label: 'Unsubscribed', description: 'The recipient opted out of all mail.' },
];

// Delay units accepted by the backend duration parser (backend utils/duration.ts).
export const DELAY_UNIT_OPTIONS: Option[] = [
    { value: 's', label: 'seconds' },
    { value: 'm', label: 'minutes' },
    { value: 'h', label: 'hours' },
    { value: 'd', label: 'days' },
    { value: 'w', label: 'weeks' },
];

// Where a template variable's value comes from, for grouping in the reference.
export type LiquidVariableSource = 'producer' | 'subscriber' | 'brand';

export interface LiquidVariable {
    name: string;
    description: string;
    source: LiquidVariableSource;
}

// The author-facing Liquid variables, mirroring backend services/render/liquid.ts.
export const LIQUID_VARIABLES: LiquidVariable[] = [
    {
        name: 'data.*',
        description: 'Any field from the payload the producing service sends, e.g. data.invoice_url. Each key is also available at the top level (invoice_url).',
        source: 'producer',
    },
    { name: 'subscriber.name', description: "The subscriber's full name, if known.", source: 'subscriber' },
    { name: 'subscriber.email', description: "The subscriber's email address.", source: 'subscriber' },
    { name: 'attributes.*', description: 'Any custom field stored on the subscriber, e.g. attributes.plan.', source: 'subscriber' },
    { name: 'first_name', description: "First word of the subscriber's name, or \"there\" if we don't have a name.", source: 'brand' },
    { name: 'brand_name', description: "The product's brand name (falls back to SalesDuo).", source: 'brand' },
    { name: 'brand_color', description: "The product's brand color hex.", source: 'brand' },
    { name: 'logo_url', description: "The product's logo URL, if set.", source: 'brand' },
];
