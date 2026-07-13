import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, notFound } from '../../utils/errors';
import { Product } from '../../models/product';

export const listProducts = asyncHandler(async (_req: Request, res: Response) => {
    const products = await Product.findAll({ order: [['created_at', 'ASC']] });
    res.json(products);
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.findByPk(req.params.id);
    if (!product) throw notFound('Product not found');
    res.json({ product });
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

/** Delete a product and everything scoped to it (FK cascades: subscribers, workflows, templates, …). */
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.findByPk(req.params.id);
    if (!product) throw notFound('Product not found');
    await product.destroy();
    res.json({ ok: true });
});
