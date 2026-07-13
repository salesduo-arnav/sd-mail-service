import { Product } from '../models/product';
import { notFound } from '../utils/errors';

/** Resolve a product by slug for internal (service-key) callers; 404 if unknown. */
export async function findProductBySlug(slug: string): Promise<Product> {
    const product = await Product.findOne({ where: { slug } });
    if (!product) throw notFound(`Product "${slug}" not found`, 'product_not_found');
    return product;
}
