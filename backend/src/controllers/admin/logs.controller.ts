import { Request, Response } from 'express';
import { fn, col, ModelStatic, Model } from 'sequelize';
import { asyncHandler, notFound } from '../../utils/errors';
import { EventLog } from '../../models/event_log';
import { WorkflowRun } from '../../models/workflow_run';
import { RunStep } from '../../models/run_step';
import { Subscriber } from '../../models/subscriber';
import { Message } from '../../models/message';
import { Suppression } from '../../models/suppression';

function scope(req: Request): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (req.query.product_id) where.product_id = req.query.product_id;
    return where;
}
const limit = (req: Request) => Math.min(Number(req.query.limit) || 100, 500);

export const listEvents = asyncHandler(async (req: Request, res: Response) => {
    const rows = await EventLog.findAll({ where: scope(req), order: [['received_at', 'DESC']], limit: limit(req) });
    res.json(rows);
});

export const listRuns = asyncHandler(async (req: Request, res: Response) => {
    const where: Record<string, unknown> = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.subscriber_id) where.subscriber_id = req.query.subscriber_id;
    // Product-scope by joining the subscriber (runs have no product_id column).
    const include = req.query.product_id
        ? [{ model: Subscriber, as: 'subscriber', attributes: [], where: { product_id: req.query.product_id }, required: true }]
        : [];
    const rows = await WorkflowRun.findAll({ where, include, order: [['created_at', 'DESC']], limit: limit(req) });
    res.json(rows);
});

/** Run drill-down: the run + its scheduled steps + the messages it produced. */
export const getRun = asyncHandler(async (req: Request, res: Response) => {
    const run = await WorkflowRun.findByPk(req.params.id);
    if (!run) throw notFound('Run not found');
    const steps = await RunStep.findAll({ where: { run_id: run.id }, order: [['step_index', 'ASC']] });
    const messages = await Message.findAll({ where: { run_id: run.id }, order: [['created_at', 'ASC']] });
    res.json({ run, steps, messages });
});

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
    const where = scope(req);
    if (req.query.status) where.status = req.query.status;
    if (req.query.type) where.type = req.query.type;
    const rows = await Message.findAll({ where, order: [['created_at', 'DESC']], limit: limit(req) });
    res.json(rows);
});

export const listSuppressions = asyncHandler(async (req: Request, res: Response) => {
    const rows = await Suppression.findAll({ where: scope(req), order: [['created_at', 'DESC']], limit: limit(req) });
    res.json(rows);
});

const countBy = async (
    model: ModelStatic<Model>,
    column: string,
    where: Record<string, unknown>,
): Promise<Record<string, number>> => {
    const rows = (await model.findAll({
        attributes: [column, [fn('COUNT', col(column)), 'n']],
        where,
        group: [column],
        raw: true,
    })) as unknown as Array<Record<string, string>>;
    return Object.fromEntries(rows.map((r) => [r[column], Number(r.n)]));
};

/** Runs-by-status, scoped to a product by joining the subscriber (runs have no product_id). */
async function runsByStatusScoped(productId: string | undefined): Promise<Record<string, number>> {
    const rows = (await WorkflowRun.findAll({
        attributes: ['status', [fn('COUNT', col('WorkflowRun.status')), 'n']],
        include: productId
            ? [{ model: Subscriber, as: 'subscriber', attributes: [], where: { product_id: productId }, required: true }]
            : [],
        group: ['WorkflowRun.status'],
        raw: true,
    })) as unknown as Array<{ status: string; n: string }>;
    return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}

/** Aggregate metrics for the dashboard (message/run/suppression breakdowns). All SQL-aggregated. */
export const metrics = asyncHandler(async (req: Request, res: Response) => {
    const where = scope(req);
    const productId = req.query.product_id ? String(req.query.product_id) : undefined;
    const [byStatus, byType, runsByStatus, suppByReason, events, txnByStatus] = await Promise.all([
        countBy(Message, 'status', where),
        countBy(Message, 'type', where),
        runsByStatusScoped(productId),
        countBy(Suppression, 'reason', where),
        EventLog.count({ where }),
        countBy(Message, 'status', { ...where, type: 'transactional' }),
    ]);
    const txnTotal = Object.values(txnByStatus).reduce((a, b) => a + b, 0);
    const txnOk = (txnByStatus.sent ?? 0) + (txnByStatus.delivered ?? 0);
    res.json({
        events,
        messages_by_status: byStatus,
        messages_by_type: byType,
        runs_by_status: runsByStatus,
        suppressions_by_reason: suppByReason,
        transactional_success_rate: txnTotal ? Number((txnOk / txnTotal).toFixed(3)) : null,
    });
});
