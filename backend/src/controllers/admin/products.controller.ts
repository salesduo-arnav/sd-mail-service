import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, notFound } from '../../utils/errors';
import { Product } from '../../models/product';
import { ApiKey } from '../../models/api_key';
import { generateApiKey, hashApiKey, encryptSecret, decryptSecret } from '../../utils/crypto';
import Logger from '../../utils/logger';

export const listProducts = asyncHandler(async (_req: Request, res: Response) => {
    const products = await Product.findAll({ order: [['created_at', 'ASC']] });
    res.json(products);
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.findByPk(req.params.id);
    if (!product) throw notFound('Product not found');
    const keys = await ApiKey.findAll({
        where: { product_id: product.id },
        attributes: ['id', 'name', 'last_used_at', 'revoked_at', 'created_at', 'key_encrypted'],
        order: [['created_at', 'DESC']],
    });
    // Expose only whether a key can be revealed — never the encrypted blob itself.
    const api_keys = keys.map((k) => ({
        id: k.id,
        name: k.name,
        last_used_at: k.last_used_at,
        revoked_at: k.revoked_at,
        created_at: k.created_at,
        revealable: !!k.key_encrypted,
    }));
    res.json({ product, api_keys });
});

const productSchema = z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    brand_name: z.string().optional().nullable(),
    brand_color: z.string().optional().nullable(),
    logo_url: z.string().optional().nullable(),
    from_email: z.string().min(1),
    reply_to_email: z.string().optional().nullable(),
    layout_html: z.string().optional().nullable(),
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid product', 'validation_error', parsed.error.flatten());
    const product = await Product.create(parsed.data);
    res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.findByPk(req.params.id);
    if (!product) throw notFound('Product not found');
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid product', 'validation_error', parsed.error.flatten());
    await product.update(parsed.data);
    res.json(product);
});

/** Create an API key — returns the plaintext. The hash is used for auth; an encrypted
 *  copy is stored so a superadmin can reveal it later. */
export const createApiKey = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.findByPk(req.params.id);
    if (!product) throw notFound('Product not found');
    const plaintext = generateApiKey();
    const key = await ApiKey.create({
        product_id: product.id,
        name: req.body?.name ?? 'api key',
        key_hash: hashApiKey(plaintext),
        key_encrypted: encryptSecret(plaintext),
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ id: key.id, name: key.name, api_key: plaintext });
});

/** Reveal a key's plaintext (superadmin-only). Works only for keys created with an
 *  encrypted copy (i.e. after this feature shipped); rotate legacy keys to reveal them. */
export const revealApiKey = asyncHandler(async (req: Request, res: Response) => {
    const key = await ApiKey.findOne({ where: { id: req.params.keyId, product_id: req.params.id } });
    if (!key) throw notFound('API key not found');
    if (!key.key_encrypted) throw notFound('This key predates reveal — rotate it to get a revealable key', 'not_revealable');
    Logger.info('api key revealed', { key_id: key.id, product_id: req.params.id, admin: req.admin?.email });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ id: key.id, api_key: decryptSecret(key.key_encrypted) });
});

export const revokeApiKey = asyncHandler(async (req: Request, res: Response) => {
    const key = await ApiKey.findByPk(req.params.keyId);
    if (!key) throw notFound('API key not found');
    await key.update({ revoked_at: new Date() });
    res.json({ ok: true });
});

/** Delete a product and everything scoped to it (FK cascades: keys, subscribers, workflows, templates, …). */
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.findByPk(req.params.id);
    if (!product) throw notFound('Product not found');
    await product.destroy();
    res.json({ ok: true });
});
