import { Op } from 'sequelize';
import { Workflow } from '../../models/workflow';
import { WorkflowVersion } from '../../models/workflow_version';
import { Subscriber } from '../../models/subscriber';
import { Product } from '../../models/product';
import { EventLog } from '../../models/event_log';
import { WorkflowRun } from '../../models/workflow_run';
import { startRun, cancelOnKeysFromSteps } from './run-executor';
import { cancelPriorRuns, cancelRun } from './cancel.service';
import Logger from '../../utils/logger';

/**
 * A workflow re-arms (latest-wins) when its own trigger appears in its cancel_on keys
 * (e.g. inactive_14d: trigger `activity`, cancel_on `activity`). Otherwise it's keep-first
 * (one active run per workflow+subscriber; a repeat trigger is ignored).
 */
function isLatestWins(workflow: Workflow, steps: ReturnType<typeof cancelOnKeysFromSteps>): boolean {
    return steps.includes(workflow.trigger_event_key);
}

/**
 * Match an ingested event to enabled workflows and start a run for each (subject to
 * the dedup policy). Returns the number of runs started.
 */
export async function matchAndStart(
    product: Product,
    event: EventLog,
    subscriber: Subscriber,
): Promise<number> {
    const workflows = await Workflow.findAll({
        where: { product_id: product.id, trigger_event_key: event.event_key, enabled: true },
    });
    if (!workflows.length) return 0;

    let started = 0;
    for (const workflow of workflows) {
        if (!workflow.active_version_id) {
            Logger.warn('workflow has no active version — skipping', { workflow: workflow.key });
            continue;
        }
        const version = await WorkflowVersion.findByPk(workflow.active_version_id);
        if (!version) continue;

        const cancelKeys = cancelOnKeysFromSteps(version.steps);
        const latestWins = isLatestWins(workflow, cancelKeys);

        const existingActive = await WorkflowRun.count({
            where: { workflow_id: workflow.id, subscriber_id: subscriber.id, status: 'active' },
        });

        if (existingActive > 0) {
            if (latestWins) {
                await cancelPriorRuns(workflow.id, subscriber.id, null);
            } else {
                // keep-first: one active run per workflow+subscriber
                Logger.info('dedup: active run exists, keeping first', {
                    workflow: workflow.key,
                    subscriber_id: subscriber.id,
                });
                continue;
            }
        }

        const run = await startRun({
            product,
            workflow,
            version,
            subscriber,
            triggerEventId: event.id,
            data: (event.data ?? {}) as Record<string, unknown>,
            now: event.occurred_at ?? event.received_at ?? new Date(),
        });
        started++;

        // Out-of-order cancel: if a counter-event that (semantically) happened at/after
        // this trigger was already ingested but processed before it, defuse the run now.
        // event_log is written synchronously at ingest, so the row exists regardless of
        // queue order. We compare by effective event time (occurred_at ?? received_at),
        // which is order-independent, rather than processing time.
        // (`cancelKeys` was computed above for the dedup check.)
        if (cancelKeys.length && run.status === 'active') {
            const effective = (e: EventLog) => (e.occurred_at ?? e.received_at ?? new Date(0)).getTime();
            const triggerTime = effective(event);
            const priors = await EventLog.findAll({
                where: {
                    product_id: product.id,
                    subscriber_id: subscriber.id,
                    event_key: { [Op.in]: cancelKeys },
                    id: { [Op.ne]: event.id },
                },
                order: [['received_at', 'DESC']],
                limit: 25,
            });
            const hit = priors.find((p) => effective(p) >= triggerTime);
            if (hit) await cancelRun(run, `cancel_on:${hit.event_key} (out-of-order)`);
        }
    }
    return started;
}
