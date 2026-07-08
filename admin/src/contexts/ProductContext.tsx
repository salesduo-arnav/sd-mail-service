import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { productsApi } from '@/services';
import type { Product } from '@/types';

interface ProductCtx {
    products: Product[];
    productId: string;
    product: Product | undefined;
    setProductId: (id: string) => void;
    refresh: () => Promise<void>;
}

const Ctx = createContext<ProductCtx | null>(null);
const KEY = 'sdmail.productId';

export function ProductProvider({ children }: { children: ReactNode }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [productId, setProductIdState] = useState<string>(() => localStorage.getItem(KEY) ?? '');

    const refresh = useCallback(async () => {
        const list = await productsApi.list();
        setProducts(list);
        setProductIdState((cur) => {
            if (cur && list.some((p) => p.id === cur)) return cur;
            return list[0]?.id ?? '';
        });
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const setProductId = (id: string) => {
        localStorage.setItem(KEY, id);
        setProductIdState(id);
    };

    const product = products.find((p) => p.id === productId);
    return <Ctx.Provider value={{ products, productId, product, setProductId, refresh }}>{children}</Ctx.Provider>;
}

export function useProducts(): ProductCtx {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useProducts must be used within ProductProvider');
    return ctx;
}
