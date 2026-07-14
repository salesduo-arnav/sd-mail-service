import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Search, ShieldX, ShieldCheck, UserPlus } from 'lucide-react';
import { subscribersApi } from '@/services';
import { useProducts } from '@/contexts/ProductContext';
import { SUPPRESSION_REASON_OPTIONS } from '@/lib/options';
import { statusVariant } from '@/lib/status';
import type { Message, Preference, Subscriber, Suppression, SuppressionReason } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AddDraft {
    external_id: string;
    email: string;
    name: string;
    timezone: string;
    attributes: string;
}
const emptyAdd: AddDraft = { external_id: '', email: '', name: '', timezone: '', attributes: '{}' };

const COMMON_TIMEZONES = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Australia/Sydney',
];

const reasonLabel = (reason: string) => SUPPRESSION_REASON_OPTIONS.find((o) => o.value === reason)?.label ?? reason;

interface Detail {
    subscriber: Subscriber;
    preferences: Preference[];
    messages: Message[];
    suppressions: Suppression[];
}

export default function Subscribers() {
    const { productId } = useProducts();
    const [q, setQ] = useState('');
    const [rows, setRows] = useState<Subscriber[]>([]);
    const [detail, setDetail] = useState<Detail | null>(null);
    const [suppressReason, setSuppressReason] = useState<SuppressionReason>('manual');
    const [add, setAdd] = useState<AddDraft | null>(null);
    const [saving, setSaving] = useState(false);

    const search = useCallback(async () => {
        if (!productId) return;
        setRows(await subscribersApi.search(productId, q));
    }, [productId, q]);

    // Auto-load on open and when the product changes; the search box filters on top.
    useEffect(() => {
        if (productId) subscribersApi.search(productId, '').then(setRows);
    }, [productId]);

    const createSubscriber = async () => {
        if (!add) return;
        if (!add.external_id) return toast.error('External ID is required');
        let attributes: Record<string, unknown> = {};
        if (add.attributes.trim()) {
            try {
                attributes = JSON.parse(add.attributes);
            } catch {
                return toast.error('Attributes must be valid JSON');
            }
        }
        setSaving(true);
        try {
            await subscribersApi.create(productId, {
                external_id: add.external_id,
                email: add.email || null,
                name: add.name || null,
                timezone: add.timezone || null,
                attributes,
            });
            toast.success('Subscriber added');
            setAdd(null);
            setQ(add.external_id);
            setRows(await subscribersApi.search(productId, add.external_id));
        } finally {
            setSaving(false);
        }
    };
    const open = async (s: Subscriber) => setDetail(await subscribersApi.get(s.id));
    const reload = async () => {
        if (detail) setDetail(await subscribersApi.get(detail.subscriber.id));
    };

    const togglePref = async (p: Preference) => {
        await subscribersApi.setPreference(
            p.subscriber_id,
            p.category,
            p.channel,
            p.status === 'subscribed' ? 'unsubscribed' : 'subscribed',
        );
        reload();
    };
    const suppress = async () => {
        if (!detail?.subscriber.email) return;
        await subscribersApi.suppress(productId, detail.subscriber.email, suppressReason);
        toast.success('Suppressed');
        reload();
    };
    const unsuppress = async (reason: SuppressionReason) => {
        if (!detail?.subscriber.email) return;
        await subscribersApi.unsuppress(productId, detail.subscriber.email, reason);
        toast.success('Removed suppression');
        reload();
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Subscribers</h1>
                    <p className="text-sm text-muted-foreground">Recipient profiles, preferences, message history, and suppression control.</p>
                </div>
                <Button onClick={() => setAdd({ ...emptyAdd })} disabled={!productId}>
                    <UserPlus className="mr-1.5 h-4 w-4" /> Add subscriber
                </Button>
            </div>

            <div className="flex gap-2">
                <Input
                    placeholder="Search by external_id or email…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && search()}
                />
                <Button onClick={search}><Search className="mr-1.5 h-4 w-4" /> Search</Button>
            </div>

            <Dialog open={!!add} onOpenChange={(o) => !o && setAdd(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Add subscriber</DialogTitle></DialogHeader>
                    {add && (
                        <div className="space-y-3">
                            <Field label="External ID" required htmlFor="sub-ext" info="The product's own user id. If it already exists, the subscriber is updated (upsert).">
                                <Input id="sub-ext" value={add.external_id} onChange={(e) => setAdd({ ...add, external_id: e.target.value })} placeholder="user_123" />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Email (optional)" htmlFor="sub-email">
                                    <Input id="sub-email" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} placeholder="jane@acme.com" />
                                </Field>
                                <Field label="Name (optional)" htmlFor="sub-name">
                                    <Input id="sub-name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
                                </Field>
                            </div>
                            <Field label="Timezone (optional)" htmlFor="sub-tz" info="IANA name, e.g. America/New_York.">
                                <Input id="sub-tz" list="tz-catalog" value={add.timezone} onChange={(e) => setAdd({ ...add, timezone: e.target.value })} placeholder="America/New_York" />
                                <datalist id="tz-catalog">{COMMON_TIMEZONES.map((t) => <option key={t} value={t} />)}</datalist>
                            </Field>
                            <Field label="Attributes (optional)" htmlFor="sub-attrs" info={'Custom JSON, usable in templates as attributes.*, e.g. {"plan": "pro"}.'}>
                                <Textarea id="sub-attrs" className="min-h-[80px] font-mono text-xs" value={add.attributes} onChange={(e) => setAdd({ ...add, attributes: e.target.value })} />
                            </Field>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAdd(null)}>Cancel</Button>
                        <Button onClick={createSubscriber} disabled={saving}>{saving ? 'Saving…' : 'Add subscriber'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>External ID</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Last seen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((s) => (
                            <TableRow key={s.id} className="cursor-pointer" onClick={() => open(s)}>
                                <TableCell className="font-mono text-sm">{s.external_id}</TableCell>
                                <TableCell>{s.email}</TableCell>
                                <TableCell>{s.name}</TableCell>
                                <TableCell className="text-muted-foreground">{s.last_seen_at?.slice(0, 19) ?? '—'}</TableCell>
                            </TableRow>
                        ))}
                        {rows.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No subscribers yet — they appear automatically as your product sends events.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    {detail && (
                        <>
                            <SheetHeader>
                                <SheetTitle>{detail.subscriber.email || detail.subscriber.external_id}</SheetTitle>
                            </SheetHeader>
                            <div className="mt-4 space-y-6">
                                <section>
                                    <h4 className="mb-2 text-sm font-semibold">Preferences</h4>
                                    {detail.preferences.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">All subscribed (no explicit opt-outs).</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {detail.preferences.map((p) => (
                                                <div key={p.id} className="flex items-center justify-between rounded-md border p-2">
                                                    <div className="text-sm">
                                                        {p.category} <span className="text-muted-foreground">· {p.channel}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-muted-foreground">{p.status}</span>
                                                        <Switch checked={p.status === 'subscribed'} onCheckedChange={() => togglePref(p)} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <h4 className="mb-2 text-sm font-semibold">Suppressions</h4>
                                    {detail.suppressions.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">None.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {detail.suppressions.map((s) => (
                                                <div key={s.id} className="flex items-center justify-between rounded-md border p-2">
                                                    <Badge variant="destructive">{reasonLabel(s.reason)}</Badge>
                                                    <Button size="sm" variant="ghost" onClick={() => unsuppress(s.reason)}>
                                                        <ShieldCheck className="mr-1.5 h-4 w-4" /> Unsuppress
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="mt-2 flex items-end gap-2">
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-xs">Add suppression</Label>
                                            <Select value={suppressReason} onValueChange={(v) => setSuppressReason(v as SuppressionReason)}>
                                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {SUPPRESSION_REASON_OPTIONS.map((o) => (
                                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button variant="outline" onClick={suppress} disabled={!detail.subscriber.email}>
                                            <ShieldX className="mr-1.5 h-4 w-4" /> Suppress
                                        </Button>
                                    </div>
                                </section>

                                <section>
                                    <h4 className="mb-2 text-sm font-semibold">Recent messages</h4>
                                    <div className="space-y-1.5">
                                        {detail.messages.map((m) => (
                                            <div key={m.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                                                <span className="text-muted-foreground">{m.created_at.slice(0, 19)}</span>
                                                <div className="flex gap-1.5">
                                                    <Badge variant={m.type === 'transactional' ? 'outline' : 'secondary'}>{m.type}</Badge>
                                                    <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                                                </div>
                                            </div>
                                        ))}
                                        {detail.messages.length === 0 && <p className="text-sm text-muted-foreground">No messages.</p>}
                                    </div>
                                </section>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
