import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { authApi } from '@/services';
import { ProductProvider } from '@/contexts/ProductContext';
import AppLayout from '@/components/layout/AppLayout';
import Login from '@/pages/Login';
import Products from '@/pages/Products';
import Workflows from '@/pages/Workflows';
import Templates from '@/pages/Templates';
import Campaigns from '@/pages/Campaigns';
import Subscribers from '@/pages/Subscribers';
import Logs from '@/pages/Logs';

export default function App() {
    const [authed, setAuthed] = useState<boolean | null>(null);
    const [email, setEmail] = useState('');

    const check = useCallback(() => {
        authApi
            .me()
            .then((r) => {
                setEmail(r.email);
                setAuthed(true);
            })
            .catch(() => setAuthed(false));
    }, []);

    useEffect(() => {
        check();
        const onUnauthorized = () => setAuthed(false);
        window.addEventListener('sdmail:unauthorized', onUnauthorized);
        return () => window.removeEventListener('sdmail:unauthorized', onUnauthorized);
    }, [check]);

    if (authed === null) {
        return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
    }
    if (!authed) {
        return (
            <Login
                onLogin={(e) => {
                    setEmail(e);
                    setAuthed(true);
                }}
            />
        );
    }

    return (
        <ProductProvider>
            <AppLayout email={email} onLoggedOut={() => setAuthed(false)}>
                <Routes>
                    <Route path="/products" element={<Products />} />
                    <Route path="/workflows" element={<Workflows />} />
                    <Route path="/templates" element={<Templates />} />
                    <Route path="/campaigns" element={<Campaigns />} />
                    <Route path="/subscribers" element={<Subscribers />} />
                    <Route path="/logs" element={<Logs />} />
                    <Route path="*" element={<Navigate to="/products" replace />} />
                </Routes>
            </AppLayout>
        </ProductProvider>
    );
}
