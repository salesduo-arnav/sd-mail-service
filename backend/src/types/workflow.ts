/** Declarative workflow step vocabulary (stored as JSON on workflow_versions.steps). */

export interface SendStep {
    type: 'send';
    channel: 'email' | 'slack' | 'in_app' | 'sms';
    template: string; // template key
}

export interface DelayStep {
    type: 'delay';
    duration: string; // "1d" | "48h" | "until:<data.field>"
}

export interface CancelOnStep {
    type: 'cancel_on';
    event_keys: string[];
}

export interface RepeatStep {
    type: 'repeat'; // re-arms the run using the preceding delay as the interval
}

export type Step = SendStep | DelayStep | CancelOnStep | RepeatStep;

export type Audience = 'event_subscriber' | 'org_owner';
export type MessageType = 'transactional' | 'marketing';
export type Channel = 'email' | 'slack' | 'in_app' | 'sms';
export type RunStatus = 'active' | 'canceled' | 'completed' | 'failed';
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed' | 'suppressed';
export type SuppressionReason = 'hard_bounce' | 'complaint' | 'unsubscribe' | 'manual';
export type StepType = 'send' | 'delay' | 'cancel_on' | 'repeat';

export interface TemplateCtaJson {
    primary?: { label: string; url: string };
    secondary?: { label: string; url: string };
}
