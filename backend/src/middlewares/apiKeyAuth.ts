import { NextFunction, Request, Response } from 'express';
import { ApiKey } from '../models/api_key';
import { Product } from '../models/product';
import { hashApiKey } from '../utils/crypto';
import { asyncHandler, unauthorized } from '../utils/errors';
import Logger from '../utils/logger';

function extractKey(req: Request): string | null {
    const auth = req.header('authorization');
    if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
    const xApiKey = req.header('x-api-key');
    if (xApiKey) return xApiKey.trim();
    return null;
}

/**
 * Product-scoped API-key auth. Resolves a Bearer / X-Api-Key value to a product
 * by comparing its SHA-256 hash against `api_keys.key_hash` (only hashes are stored).
 * Sets `req.product` + `req.apiKey`. A leaked key's blast radius is one product.
 */
export const apiKeyAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const plaintext = extractKey(req);
    if (!plaintext) throw unauthorized('Missing API key', 'missing_api_key');

    const key = await ApiKey.findOne({
        where: { key_hash: hashApiKey(plaintext), revoked_at: null },
        include: [{ model: Product, as: 'product' }],
    });
    if (!key) throw unauthorized('Invalid or revoked API key', 'invalid_api_key');

    const product = (key as ApiKey & { product?: Product }).product;
    if (!product) throw unauthorized('API key has no product', 'invalid_api_key');

    req.apiKey = key;
    req.product = product;

    // Best-effort last-used tracking (don't block the request).
    ApiKey.update({ last_used_at: new Date() }, { where: { id: key.id } }).catch((err) =>
        Logger.warn('failed to update api_key.last_used_at', { message: err?.message }),
    );

    next();
});
