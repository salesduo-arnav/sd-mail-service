import { Workflow } from '../../models/workflow';
import { WorkflowVersion } from '../../models/workflow_version';
import { Subscriber } from '../../models/subscriber';
import { WorkflowRun } from '../../models/workflow_run';
import { RunStep } from '../../models/run_step';
import { Template } from '../../models/template';
import { Product } from '../../models/product';
import { Step, SendStep, Audience } from '../../types/workflow';
import { resolveFireAt, msUntil } from '../../utils/duration';
import { enqueueDelayedSend } from '../../queues';
import { sendTemplate } from '../delivery/send.service';
import Logger from '../../utils/logger';

/** Union of every cancel_on step's keys — these defuse the whole run. */
export function cancelOnKeysFromSteps(steps: Step[]): string[] {
    const keys = new Set<string>();
    for (const s of steps) if (s.type === 'cancel_on') s.event_keys.forEach((k) => keys.add(k));
    return [...keys];
}

export function hasRepeat(steps: Step[]): boolean {
    return steps.some((s) => s.type === 'repeat');
}

/** Resolve the recipient email for a send's audience. */
export function resolveRecipientEmail(audience: Audience, subscriber: Subscriber): string | null {
    if (audience === 'org_owner') {
        const attrs = (subscriber.attributes ?? {}) as Record<string, unknown>;
        return (
            (attrs.org_owner_email as string) ?? (attrs.owner_email as string) ?? subscriber.email ?? null
        );
    }
    return subscriber.email ?? null;
}

export interface StartRunCtx {
    product: Product;
    workflow: Workflow;
    version: WorkflowVersion;
    subscriber: Subscriber;
    triggerEventId: string | null;
    data: Record<string, unknown>;
    now: Date;
}

/** Render + gate + send a single send step (immediate or delayed). Missing template is logged, not fatal. */
export async function performSend(params: {
    product: Product;
    workflow: Workflow;
    subscriber: Subscriber;
    sendStep: SendStep;
    data: Record<string, unknown>;
    runId: string;
    runStepId: string;
}): Promise<void> {
    const template = await Template.findOne({
        where: { product_id: params.product.id, key: params.sendStep.template },
    });
    if (!template) {
        Logger.error('performSend: template not found — dropping send', {
            product_id: params.product.id,
            template: params.sendStep.template,
        });
        return;
    }
    const audience = params.workflow.audience as Audience;
    const toEmail = resolveRecipientEmail(audience, params.subscriber);
    await sendTemplate({
        product: params.product,
        template,
        toEmail,
        subscriber: params.subscriber,
        data: params.data,
        category: params.workflow.category,
        runId: params.runId,
        runStepId: params.runStepId,
    });
}

/**
 * Create a run and schedule its steps. Immediate (leading) sends deliver inline;
 * sends after a delay become BullMQ delayed jobs (one run_step each). cancel_on keys
 * are aggregated onto the run. A run with a pending delayed send stays active.
 */
export async function startRun(ctx: StartRunCtx): Promise<WorkflowRun> {
    const steps = ctx.version.steps;
    const run = await WorkflowRun.create({
        workflow_id: ctx.workflow.id,
        workflow_version_id: ctx.version.id,
        subscriber_id: ctx.subscriber.id,
        trigger_event_id: ctx.triggerEventId,
        status: 'active',
        cancel_on: cancelOnKeysFromSteps(steps),
    });

    let cursor = ctx.now;
    let hasDelay = false;
    let pending = 0;

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step.type === 'delay') {
            cursor = resolveFireAt(step.duration, cursor, ctx.data);
            hasDelay = true;
        } else if (step.type === 'send') {
            if (!hasDelay) {
                const rs = await RunStep.create({
                    run_id: run.id,
                    step_index: i,
                    step_type: 'send',
                    scheduled_for: ctx.now,
                });
                await performSend({
                    product: ctx.product,
                    workflow: ctx.workflow,
                    subscriber: ctx.subscriber,
                    sendStep: step,
                    data: ctx.data,
                    runId: run.id,
                    runStepId: rs.id,
                });
                await rs.update({ executed_at: new Date() });
            } else {
                const rs = await RunStep.create({
                    run_id: run.id,
                    step_index: i,
                    step_type: 'send',
                    scheduled_for: cursor,
                    job_id: null,
                });
                // Schedule relative to real now; `cursor` is the absolute target time.
                await enqueueDelayedSend(rs.id, msUntil(cursor));
                await rs.update({ job_id: rs.id });
                pending++;
            }
        }
    }

    if (pending === 0 && !hasRepeat(steps)) {
        await run.update({ status: 'completed', completed_at: new Date() });
    }
    Logger.info('run started', {
        run_id: run.id,
        workflow: ctx.workflow.key,
        subscriber_id: ctx.subscriber.id,
        pending_sends: pending,
    });
    return run;
}
