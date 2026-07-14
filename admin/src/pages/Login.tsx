import { FormEvent, useState } from 'react';
import { Mail } from 'lucide-react';
import { authApi } from '@/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login({ onLogin }: { onLogin: (email: string) => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const r = await authApi.login(email, password);
            onLogin(r.email);
        } catch {
            setError('Invalid email or password');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-muted/30 p-6">
            <Card className="w-full max-w-sm">
                <CardHeader className="space-y-3 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-brand-gradient text-white">
                        <Mail className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">sd-mail-service</CardTitle>
                        <CardDescription>Superadmin sign in</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <Button type="submit" className="w-full" disabled={busy}>
                            {busy ? 'Signing in…' : 'Sign in'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
