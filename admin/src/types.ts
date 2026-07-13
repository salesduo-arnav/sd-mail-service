// Shared API types (mirror the backend models/admin responses).

export type Channel = 'email' | 'slack' | 'in_app' | 'sms';
export type Audience = 'event_subscriber' | 'org_owner';
export type MessageType = 'transactional' | 'marketing';
export type SuppressionReason = 'hard_bounce' | 'complaint' | 'unsubscribe' | 'manual';

export interface Product {
    id: string;
    slug: string;
    name: string;
    brand_name: string | null;
    brand_color: string | null;
    logo_url: string | null;
    from_email: string;
    reply_to_email: string | null;
    layout_html: string | null;
    created_at?: string;
}

// ---- Workflow steps ----
export interface SendStep {
    type: 'send';
    channel: Channel;
    template: string;
}
export interface DelayStep {
    type: 'delay';
    duration: string;
}
export interface CancelOnStep {
    type: 'cancel_on';
    event_keys: string[];
}
export interface RepeatStep {
    type: 'repeat';
}
export type Step = SendStep | DelayStep | CancelOnStep | RepeatStep;

export interface Workflow {
    id: string;
    product_id: string;
    key: string;
    name: string;
    trigger_event_key: string;
    category: string;
    audience: Audience;
    active_version_id: string | null;
    enabled: boolean;
    created_at?: string;
}

export interface WorkflowVersion {
    id: string;
    workflow_id: string;
    version: number;
    steps: Step[];
    created_by: string | null;
    created_at: string;
}

export interface CtaBlock {
    label: string;
    url: string;
}
export interface TemplateCta {
    primary?: CtaBlock;
    secondary?: CtaBlock;
}

export interface Template {
    id: string;
    product_id: string;
    key: string;
    type: MessageType;
    channel: Channel;
    subject: string | null;
    body: string | null;
    cta: TemplateCta | null;
    updated_at?: string;
}

export interface Subscriber {
    id: string;
    product_id: string;
    external_id: string;
    email: string | null;
    name: string | null;
    attributes: Record<string, unknown>;
    timezone: string | null;
    last_seen_at: string | null;
}

export interface Preference {
    id: string;
    subscriber_id: string;
    category: string;
    channel: Channel;
    status: 'subscribed' | 'unsubscribed';
}

export interface Suppression {
    id: string;
    product_id: string;
    email: string;
    reason: SuppressionReason;
    created_at: string;
}

export interface Message {
    id: string;
    type: MessageType;
    to_email: string;
    subscriber_id: string | null;
    run_id: string | null;
    status: string;
    channel: string;
    provider_message_id: string | null;
    error: string | null;
    created_at: string;
}

export interface RunStep {
    id: string;
    run_id: string;
    step_index: number;
    step_type: string;
    scheduled_for: string | null;
    job_id: string | null;
    executed_at: string | null;
}

export interface WorkflowRun {
    id: string;
    workflow_id: string;
    workflow_version_id: string | null;
    subscriber_id: string;
    status: string;
    cancel_on: string[] | null;
    created_at: string;
    completed_at: string | null;
}

export interface CampaignCounts {
    sent: number;
    suppressed: number;
    failed: number;
    processed: number;
}

export interface Campaign {
    id: string;
    product_id: string;
    name: string;
    template_id: string | null;
    category: string;
    subject: string | null;
    body: string | null;
    cta: TemplateCta | null;
    status: 'draft' | 'queued' | 'sending' | 'sent' | 'failed';
    total_recipients: number;
    created_at: string;
    completed_at: string | null;
    counts?: CampaignCounts;
}

export interface Metrics {
    events: number;
    messages_by_status: Record<string, number>;
    messages_by_type: Record<string, number>;
    runs_by_status: Record<string, number>;
    suppressions_by_reason: Record<string, number>;
    transactional_success_rate: number | null;
}
