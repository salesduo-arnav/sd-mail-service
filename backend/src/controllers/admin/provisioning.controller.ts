import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/errors';
import { provisionCatalog } from '../../provisioning/catalog';

/**
 * Idempotently (re-)provision the canonical mail catalog — the SalesDuo
 * products/templates/workflows. Existing rows are left untouched, so this is safe to
 * click repeatedly; the response summary reports what was created vs. already present.
 */
export const runProvisioning = asyncHandler(async (req: Request, res: Response) => {
    const summary = await provisionCatalog({ createdBy: req.admin?.admin_id ?? null });
    res.json(summary);
});
