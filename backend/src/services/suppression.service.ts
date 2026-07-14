import { Suppression } from '../models/suppression';
import { MessageType, SuppressionReason } from '../types/workflow';
import { normalizeEmail } from '../utils/email';
import Logger from '../utils/logger';

/** Reasons that block marketing mail (everything). Transactional honors only hard_bounce. */
const TRANSACTIONAL_BLOCKING: SuppressionReason[] = ['hard_bounce'];

export interface SuppressionCheck {
    blocked: boolean;
    reason?: SuppressionReason;
}

/**
 * Class-aware suppression gate. Marketing is blocked by ANY suppression reason;
 * transactional is blocked ONLY by hard_bounce (so unsubscribing never blocks an OTP,
 * but a dead address is never mailed).
 */
export async function checkSuppression(
    productId: string,
    email: string,
    type: MessageType,
): Promise<SuppressionCheck> {
    const rows = await Suppression.findAll({ where: { product_id: productId, email: normalizeEmail(email) } });
    if (!rows.length) return { blocked: false };

    for (const row of rows) {
        const blocks = type === 'transactional' ? TRANSACTIONAL_BLOCKING.includes(row.reason) : true;
        if (blocks) return { blocked: true, reason: row.reason };
    }
    return { blocked: false };
}

/** Add a suppression (idempotent per product/email/reason). */
export async function addSuppression(
    productId: string,
    email: string,
    reason: SuppressionReason,
): Promise<void> {
    const normalized = normalizeEmail(email);
    await Suppression.findOrCreate({
        where: { product_id: productId, email: normalized, reason },
        defaults: { product_id: productId, email: normalized, reason },
    });
    Logger.info('suppression added', { product_id: productId, email: normalized, reason });
}

export async function removeSuppression(
    productId: string,
    email: string,
    reason?: SuppressionReason,
): Promise<number> {
    const where: Record<string, unknown> = { product_id: productId, email: normalizeEmail(email) };
    if (reason) where.reason = reason;
    return Suppression.destroy({ where });
}
