declare global {
    namespace Express {
        interface Request {
            /** Set by requireServiceAuth — the calling internal service name. */
            serviceName?: string;
            /** Set by requireAdmin — the authenticated superadmin session. */
            admin?: { admin_id: string; email: string };
        }
    }
}

export {};
