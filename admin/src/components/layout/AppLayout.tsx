import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Mail, Package, Workflow, FileText, Users, ScrollText, LogOut } from 'lucide-react';
import { authApi } from '@/services';
import { useProducts } from '@/contexts/ProductContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV = [
    { to: '/products', label: 'Products', icon: Package },
    { to: '/workflows', label: 'Workflows', icon: Workflow },
    { to: '/templates', label: 'Templates', icon: FileText },
    { to: '/subscribers', label: 'Subscribers', icon: Users },
    { to: '/logs', label: 'Logs', icon: ScrollText },
];

export default function AppLayout({
    children,
    email,
    onLoggedOut,
}: {
    children: ReactNode;
    email: string;
    onLoggedOut: () => void;
}) {
    const { products, productId, setProductId } = useProducts();

    const logout = async () => {
        await authApi.logout().catch(() => undefined);
        onLoggedOut();
    };

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar */}
            <aside className="flex w-60 flex-shrink-0 flex-col border-r bg-card">
                <div className="flex items-center gap-2 px-5 py-4 border-b">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[#ffa21b] to-[#ff8a1b] text-white">
                        <Mail className="h-4 w-4" />
                    </div>
                    <div className="leading-tight">
                        <div className="text-sm font-semibold">sd-mail-service</div>
                        <div className="text-xs text-muted-foreground">Admin</div>
                    </div>
                </div>
                <nav className="flex-1 space-y-1 p-3">
                    {NAV.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                cn(
                                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                )
                            }
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </NavLink>
                    ))}
                </nav>
                <div className="border-t p-3">
                    <div className="mb-2 truncate px-2 text-xs text-muted-foreground" title={email}>
                        {email}
                        <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] uppercase">superadmin</span>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
                        <LogOut className="mr-2 h-4 w-4" /> Log out
                    </Button>
                </div>
            </aside>

            {/* Main */}
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b bg-card px-6">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Product</span>
                    <Select value={productId} onValueChange={setProductId}>
                        <SelectTrigger className="h-9 w-56">
                            <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                        <SelectContent>
                            {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.slug}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </header>
                <main className="flex-1 overflow-auto p-6">
                    <div className="mx-auto max-w-6xl">{children}</div>
                </main>
            </div>
        </div>
    );
}
