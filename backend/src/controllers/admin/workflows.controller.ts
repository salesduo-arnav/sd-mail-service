import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, notFound } from '../../utils/errors';
import { Workflow } from '../../models/workflow';
import { WorkflowVersion } from '../../models/workflow_version';
import { Step } from '../../types/workflow';

const stepSchema: z.ZodType<Step> = z.union([
    z.object({ type: z.literal('send'), channel: z.enum(['email', 'slack', 'in_app', 'sms']), template: z.string(), audience: z.enum(['event_subscriber', 'org_owner']).optional() }),
    z.object({ type: z.literal('delay'), duration: z.string() }),
    z.object({ type: z.literal('cancel_on'), event_keys: z.array(z.string()) }),
    z.object({ type: z.literal('repeat'), every: z.string().optional(), until: z.string().optional() }),
]);

export const listWorkflows = asyncHandler(async (req: Request, res: Response) => {
    const where: Record<string, unknown> = {};
    if (req.query.product_id) where.product_id = req.query.product_id;
    const workflows = await Workflow.findAll({ where, order: [['created_at', 'ASC']] });
    res.json(workflows);
});

export const getWorkflow = asyncHandler(async (req: Request, res: Response) => {
    const workflow = await Workflow.findByPk(req.params.id);
    if (!workflow) throw notFound('Workflow not found');
    const versions = await WorkflowVersion.findAll({ where: { workflow_id: workflow.id }, order: [['version', 'DESC']] });
    const active = workflow.active_version_id ? versions.find((v) => v.id === workflow.active_version_id) : null;
    res.json({ workflow, active_version: active, versions });
});

const createSchema = z.object({
    product_id: z.string().uuid(),
    key: z.string().min(1),
    name: z.string().min(1),
    trigger_event_key: z.string().min(1),
    category: z.string().min(1),
    audience: z.enum(['event_subscriber', 'org_owner']).default('event_subscriber'),
    steps: z.array(stepSchema).min(1),
});

export const createWorkflow = asyncHandler(async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid workflow', 'validation_error', parsed.error.flatten());
    const d = parsed.data;
    const workflow = await Workflow.create({
        product_id: d.product_id,
        key: d.key,
        name: d.name,
        trigger_event_key: d.trigger_event_key,
        category: d.category,
        audience: d.audience,
    });
    const version = await WorkflowVersion.create({
        workflow_id: workflow.id,
        version: 1,
        steps: d.steps,
        created_by: req.admin?.admin_id ?? null,
    });
    await workflow.update({ active_version_id: version.id });
    res.status(201).json({ workflow, active_version: version });
});

const updateSchema = z.object({
    name: z.string().optional(),
    trigger_event_key: z.string().optional(),
    category: z.string().optional(),
    audience: z.enum(['event_subscriber', 'org_owner']).optional(),
    steps: z.array(stepSchema).min(1).optional(),
});

/** Edit a workflow. Changing `steps` creates a NEW version and moves the active pointer;
 *  in-flight runs keep the version they pinned. */
export const updateWorkflow = asyncHandler(async (req: Request, res: Response) => {
    const workflow = await Workflow.findByPk(req.params.id);
    if (!workflow) throw notFound('Workflow not found');
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid workflow', 'validation_error', parsed.error.flatten());
    const d = parsed.data;

    const meta: Record<string, unknown> = {};
    if (d.name !== undefined) meta.name = d.name;
    if (d.trigger_event_key !== undefined) meta.trigger_event_key = d.trigger_event_key;
    if (d.category !== undefined) meta.category = d.category;
    if (d.audience !== undefined) meta.audience = d.audience;
    if (Object.keys(meta).length) await workflow.update(meta);

    let newVersion: WorkflowVersion | null = null;
    if (d.steps) {
        const last = await WorkflowVersion.findOne({ where: { workflow_id: workflow.id }, order: [['version', 'DESC']] });
        newVersion = await WorkflowVersion.create({
            workflow_id: workflow.id,
            version: (last?.version ?? 0) + 1,
            steps: d.steps,
            created_by: req.admin?.admin_id ?? null,
        });
        await workflow.update({ active_version_id: newVersion.id });
    }
    res.json({ workflow, new_version: newVersion });
});

export const toggleWorkflow = asyncHandler(async (req: Request, res: Response) => {
    const workflow = await Workflow.findByPk(req.params.id);
    if (!workflow) throw notFound('Workflow not found');
    const enabled = Boolean(req.body?.enabled);
    await workflow.update({ enabled });
    res.json({ id: workflow.id, enabled });
});

/** Roll back / forward: re-point active_version_id to any existing version of this workflow. */
export const activateVersion = asyncHandler(async (req: Request, res: Response) => {
    const workflow = await Workflow.findByPk(req.params.id);
    if (!workflow) throw notFound('Workflow not found');
    const versionId = String(req.body?.version_id ?? '');
    const version = await WorkflowVersion.findOne({ where: { id: versionId, workflow_id: workflow.id } });
    if (!version) throw badRequest('version_id not found for this workflow', 'invalid_version');
    await workflow.update({ active_version_id: version.id });
    res.json({ id: workflow.id, active_version_id: version.id, version: version.version });
});

/** Delete a workflow. FK cascades remove its versions/runs/steps; templates unlink; messages keep. */
export const deleteWorkflow = asyncHandler(async (req: Request, res: Response) => {
    const workflow = await Workflow.findByPk(req.params.id);
    if (!workflow) throw notFound('Workflow not found');
    await workflow.destroy();
    res.json({ ok: true });
});
