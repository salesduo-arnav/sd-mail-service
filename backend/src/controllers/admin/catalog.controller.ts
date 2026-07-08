import { Request, Response } from 'express';
import { fn, col } from 'sequelize';
import { asyncHandler } from '../../utils/errors';
import { EventLog } from '../../models/event_log';
import { Workflow } from '../../models/workflow';
import { WorkflowVersion } from '../../models/workflow_version';
import { Step } from '../../types/workflow';

/**
 * Distinct event keys relevant to a product — those observed in event_log plus the
 * trigger + cancel_on keys referenced by its workflows. Powers the workflow builder's
 * event-key pickers so admins don't hand-type strings.
 */
export const eventCatalog = asyncHandler(async (req: Request, res: Response) => {
    const productId = req.query.product_id ? String(req.query.product_id) : null;
    const keys = new Set<string>();

    const events = (await EventLog.findAll({
        attributes: [[fn('DISTINCT', col('event_key')), 'event_key']],
        where: productId ? { product_id: productId } : {},
        raw: true,
    })) as unknown as Array<{ event_key: string }>;
    events.forEach((e) => e.event_key && keys.add(e.event_key));

    const workflows = await Workflow.findAll({ where: productId ? { product_id: productId } : {} });
    workflows.forEach((w) => w.trigger_event_key && keys.add(w.trigger_event_key));

    const versionIds = workflows.map((w) => w.active_version_id).filter(Boolean) as string[];
    if (versionIds.length) {
        const versions = await WorkflowVersion.findAll({ where: { id: versionIds } });
        for (const v of versions) {
            for (const s of v.steps as Step[]) {
                if (s.type === 'cancel_on') s.event_keys.forEach((k) => keys.add(k));
            }
        }
    }

    res.json([...keys].sort());
});

/** Distinct workflow categories for a product, plus the documented defaults. */
export const categoryCatalog = asyncHandler(async (req: Request, res: Response) => {
    const productId = req.query.product_id ? String(req.query.product_id) : null;
    const rows = (await Workflow.findAll({
        attributes: [[fn('DISTINCT', col('category')), 'category']],
        where: productId ? { product_id: productId } : {},
        raw: true,
    })) as unknown as Array<{ category: string }>;
    const cats = new Set<string>(['onboarding', 'billing', 'reengagement', 'transactional']);
    rows.forEach((r) => r.category && cats.add(r.category));
    res.json([...cats].sort());
});
