import { Op, literal } from 'sequelize';
import sequelize from '../config/db';
import { Workflow } from '../models/workflow';
import { WorkflowVersion } from '../models/workflow_version';
import { Subscriber } from '../models/subscriber';
import { Product } from '../models/product';
import { parseDuration } from '../utils/duration';
import { hasRepeat, startRun } from './engine/run-executor';
import Logger from '../utils/logger';

const BATCH = 500;
const MAX_PER_WORKFLOW = 50_000; // safety cap on a single nightly run

/**
 * Nightly backstop for recurring inactivity workflows: arms a run for subscribers
 * whose inactivity timer was never scheduled (e.g. onboarded before the feature),
 * so they still get a re-engagement nudge. Idempotent — subscribers with an active
 * run are skipped.
 */
export async function runInactivitySweep(): Promise<number> {
    const workflows = await Workflow.findAll({ where: { enabled: true } });
    let armed = 0;

    for (const wf of workflows) {
        if (!wf.active_version_id) continue;
        const version = await WorkflowVersion.findByPk(wf.active_version_id);
        if (!version || !hasRepeat(version.steps)) continue;

        const delayStep = version.steps.find((s) => s.type === 'delay');
        if (!delayStep || delayStep.type !== 'delay') continue;
        let thresholdMs: number;
        try {
            const p = parseDuration(delayStep.duration);
            if (p.kind !== 'relative') continue;
            thresholdMs = p.ms;
        } catch {
            continue;
        }

        const cutoff = new Date(Date.now() - thresholdMs);
        const product = await Product.findByPk(wf.product_id);
        if (!product) continue;

        // Single query per page: inactive subscribers with NO active run for this
        // workflow (replaces the per-subscriber count). Drains in pages — each armed
        // subscriber gains an active run and is excluded from the next page.
        let workflowArmed = 0;
        // wf.id is escaped (not string-interpolated) so the subquery is injection-safe.
        const noActiveRun = literal(
            `NOT EXISTS (SELECT 1 FROM workflow_runs r WHERE r.subscriber_id = "Subscriber"."id" AND r.workflow_id = ${sequelize.escape(wf.id)} AND r.status = 'active')`,
        );
        for (;;) {
            const subs = await Subscriber.findAll({
                where: { product_id: wf.product_id, last_seen_at: { [Op.lt]: cutoff }, [Op.and]: [noActiveRun] },
                limit: BATCH,
            });
            if (!subs.length) break;
            for (const sub of subs) {
                await startRun({
                    product,
                    workflow: wf,
                    version,
                    subscriber: sub,
                    triggerEventId: null,
                    data: {},
                    now: sub.last_seen_at ?? new Date(),
                });
                armed++;
                workflowArmed++;
            }
            if (subs.length < BATCH || workflowArmed >= MAX_PER_WORKFLOW) break;
        }
    }

    Logger.info('inactivity sweep complete', { armed });
    return armed;
}
