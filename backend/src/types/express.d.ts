import type { Product } from '../models/product';
import type { ApiKey } from '../models/api_key';

declare global {
    namespace Express {
        interface Request {
            /** Set by apiKeyAuth — the product this request is scoped to. */
            product?: Product;
            apiKey?: ApiKey;
            /** Set by requireServiceAuth — the calling internal service name. */
            serviceName?: string;
            /** Set by requireAdmin — the authenticated superadmin session. */
            admin?: { admin_id: string; email: string };
        }
    }
}

export {};
