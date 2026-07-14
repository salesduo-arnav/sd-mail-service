import { Op } from 'sequelize';
import { RunStep } from '../../models/run_step';
import { WorkflowRun } from '../../models/workflow_run';
import { Workflow } from '../../models/workflow';
import { WorkflowVersion } from '../../models/workflow_version';
import { Product } from '../../models/product';
import { Subscriber } from '../../models/subscriber';
import { EventLog } from '../../models/event_log';
import { SendStep } from '../../types/workflow';
import { withLock } from '../../config/redis';
import { performSend, startRun, hasRepeat } from './run-executor';
import Logger from '../../utils/logger';

/**
 * Fire a scheduled (delayed) send when its BullMQ job comes due. Re-checks run
 * status, workflow enabled, preferences, and suppression at fire time (not schedule
 * time), so a canceled/opted-out/disabled run no-ops.
 *
 * Idempotency: the actual no-double-email guarantee is the unique `messages.run_step_id`
 * (see send.service). We do NOT early-return on `executed_at`, because completion +
 * re-arm run AFTER the send — returning early there would leave a recurring workflow
 * un-rearmed if a retry happened between the send and the re-arm. A completed run is
 * caught by the `status !== 'active'` check below.
 */
export async function fireRunStep(runStepId: string): Promise<void> {
    const rs = await RunStep.findByPk(runStepId);
    if (!rs) return;
    const owner = await WorkflowRun.findByPk(rs.run_id);
    if (!owner) return;

    // Serialize with event processing for this subscriber (process-event uses the same
    // lock). Otherwise the re-arm below can race a concurrent cancel/match and leave two
    // active runs for the same (workflow, subscriber).
    await withLock(`sdmail:lock:sub:${owner.subscriber_id}`, () => fireRunStepLocked(rs));
}

async function fireRunStepLocked(rs: RunStep): Promise<void> {
    const run = await WorkflowRun.findByPk(rs.run_id);
    if (!run || run.status !== 'active') {
        Logger.info('fireRunStep: run not active — no-op', { runStepId: rs.id, status: run?.status });
        return;
    }

    const workflow = await Workflow.findByPk(run.workflow_id);
    if (!workflow || !workflow.enabled) {
        // Disabling a workflow mid-run must stop the run, not leave it 'active' forever:
        // a stuck active run leaks and also blocks future legitimate runs via keep-first
        // dedup. The delayed job is already consumed, so just finalize the run.
        await run.update({ status: 'canceled', completed_at: new Date() });
        Logger.info('fireRunStep: workflow disabled — run canceled', { runStepId: rs.id, workflow_id: run.workflow_id });
        return;
    }

    const version = run.workflow_version_id ? await WorkflowVersion.findByPk(run.workflow_version_id) : null;
    const steps = version?.steps ?? [];
    const step = steps[rs.step_index];
    if (!step || step.type !== 'send') {
        Logger.error('fireRunStep: step is not a send', { runStepId: rs.id, step_index: rs.step_index });
        await rs.update({ executed_at: new Date() });
        return;
    }

    const product = await Product.findByPk(workflow.product_id);
    const subscriber = await Subscriber.findByPk(run.subscriber_id);
    if (!product || !subscriber) return;

    const event = run.trigger_event_id ? await EventLog.findByPk(run.trigger_event_id) : null;
    const data = (event?.data ?? {}) as Record<string, unknown>;

    // Idempotent (unique messages.run_step_id): a retry after a mid-completion
    // failure re-runs this without sending twice.
    await performSend({
        product,
        workflow,
        subscriber,
        sendStep: step as SendStep,
        data,
        runId: run.id,
        runStepId: rs.id,
    });
    if (!rs.executed_at) await rs.update({ executed_at: new Date() });

    // Re-arm recurring workflows (e.g. inactive_14d) for the next window; else complete.
    if (hasRepeat(steps) && version) {
        // Idempotent re-arm: only arm if no other active run for this (workflow,
        // subscriber) already exists — so a retry after a successful re-arm won't
        // create a duplicate armed run.
        const alreadyArmed = await WorkflowRun.count({
            where: { workflow_id: workflow.id, subscriber_id: subscriber.id, status: 'active', id: { [Op.ne]: run.id } },
        });
        if (alreadyArmed === 0) {
            await startRun({
                product,
                workflow,
                version,
                subscriber,
                triggerEventId: run.trigger_event_id,
                data,
                now: new Date(),
            });
            Logger.info('fireRunStep: re-armed recurring run', { workflow: workflow.key, subscriber_id: subscriber.id });
        }
        await run.update({ status: 'completed', completed_at: new Date() });
    } else {
        const pending = await RunStep.count({ where: { run_id: run.id, executed_at: null } });
        if (pending === 0) await run.update({ status: 'completed', completed_at: new Date() });
    }
}
