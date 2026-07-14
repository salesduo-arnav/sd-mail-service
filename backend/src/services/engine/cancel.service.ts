import { Op } from 'sequelize';
import { WorkflowRun } from '../../models/workflow_run';
import { RunStep } from '../../models/run_step';
import { removeDelayedJob } from '../../queues';
import Logger from '../../utils/logger';

/** Cancel a single active run and remove its pending delayed jobs. */
export async function cancelRun(run: WorkflowRun, cause: string): Promise<void> {
    if (run.status !== 'active') return;
    await run.update({ status: 'canceled', completed_at: new Date() });
    const steps = await RunStep.findAll({ where: { run_id: run.id, executed_at: null, job_id: { [Op.ne]: null } } });
    // Best-effort: the run is already canceled in the DB, and fireRunStep no-ops a
    // non-active run at fire time. So a transient Redis error removing a delayed job must
    // NOT throw here — otherwise the enclosing event handler retries and re-runs sends
    // that already went out (duplicate email).
    for (const s of steps) {
        if (!s.job_id) continue;
        try {
            await removeDelayedJob(s.job_id);
        } catch (err) {
            Logger.warn('cancelRun: could not remove delayed job (will no-op at fire time)', {
                run_id: run.id,
                job_id: s.job_id,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    Logger.info('run canceled', { run_id: run.id, cause });
}

/**
 * Cancel active runs for a subscriber whose cancel_on guard matches this event.
 * Excludes the run just started by this same event (so a self-canceling re-arming
 * trigger like `activity` doesn't defuse its own fresh run).
 */
export async function cancelRunsForEvent(
    subscriberId: string,
    eventKey: string,
    excludeTriggerEventId: string | null,
): Promise<number> {
    const runs = await WorkflowRun.findAll({ where: { subscriber_id: subscriberId, status: 'active' } });
    let canceled = 0;
    for (const run of runs) {
        if (excludeTriggerEventId && run.trigger_event_id === excludeTriggerEventId) continue;
        const guards = (run.cancel_on ?? []) as string[];
        if (guards.includes(eventKey)) {
            await cancelRun(run, `cancel_on:${eventKey}`);
            canceled++;
        }
    }
    return canceled;
}

/** Cancel prior active runs for a (workflow, subscriber) — used by latest-wins dedup. */
export async function cancelPriorRuns(
    workflowId: string,
    subscriberId: string,
    excludeRunId: string | null,
): Promise<number> {
    const runs = await WorkflowRun.findAll({
        where: { workflow_id: workflowId, subscriber_id: subscriberId, status: 'active' },
    });
    let canceled = 0;
    for (const run of runs) {
        if (excludeRunId && run.id === excludeRunId) continue;
        await cancelRun(run, 'superseded');
        canceled++;
    }
    return canceled;
}
