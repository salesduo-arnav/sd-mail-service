import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Send, Plus, RefreshCw } from 'lucide-react';
import { campaignsApi, templatesApi } from '@/services';
import { useProducts } from '@/contexts/ProductContext';
import type { Campaign, Template, TemplateCta } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Mode = 'template' | 'compose';

interface Draft {
    name: string;
    category: string;
    mode: Mode;
    template_id: string;
    subject: string;
    body: string;
    cta: TemplateCta | null;
}

const emptyDraft: Draft = {
    name: '',
    category: 'marketing',
    mode: 'template',
    template_id: '',
    subject: '',
    body: '',
    cta: null,
};

const statusVariant = (s: string) =>
    s === 'sent' ? 'default' : s === 'failed' ? 'destructive' : 'secondary';

export default function Campaigns() {
    const { productId } = useProducts();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [audience, setAudience] = useState(0);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [sending, setSending] = useState(false);

    const load = useCallback(() => {
        if (!productId) return;
        campaignsApi.list(productId).then(setCampaigns);
        templatesApi.list(productId).then((ts) => setTemplates(ts.filter((t) => t.type === 'marketing')));
        campaignsApi.audienceCount(productId).then((r) => setAudience(r.count));
    }, [productId]);
    useEffect(load, [load]);

    const setCta = (which: 'primary' | 'secondary', field: 'label' | 'url', v: string) => {
        if (!draft) return;
        const cta: TemplateCta = { ...(draft.cta ?? {}) };
        cta[which] = { label: cta[which]?.label ?? '', url: cta[which]?.url ?? '', [field]: v };
        setDraft({ ...draft, cta });
    };

    const send = async () => {
        if (!draft) return;
        if (!draft.name) return toast.error('Give the campaign a name');
        if (draft.mode === 'template' && !draft.template_id) return toast.error('Pick a template');
        if (draft.mode === 'compose' && (!draft.subject || !draft.body)) return toast.error('Subject and body are required');
        setSending(true);
        try {
            await campaignsApi.create({
                product_id: productId,
                name: draft.name,
                category: draft.category,
                template_id: draft.mode === 'template' ? draft.template_id : null,
                subject: draft.mode === 'compose' ? draft.subject : null,
                body: draft.mode === 'compose' ? draft.body : null,
                cta: draft.mode === 'compose' ? draft.cta : null,
            });
            toast.success(`Campaign queued to ~${audience} subscriber(s)`);
            setDraft(null);
            load();
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Campaigns</h1>
                    <p className="text-sm text-muted-foreground">
                        Send a marketing email to all subscribers of this product. Suppressions, opt-outs, and the
                        unsubscribe footer are applied automatically.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={load} title="Refresh"><RefreshCw className="h-4 w-4" /></Button>
                    <Button onClick={() => setDraft({ ...emptyDraft })} disabled={!productId}>
                        <Plus className="mr-1.5 h-4 w-4" /> New campaign
                    </Button>
                </div>
            </div>

            <div className="rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Recipients</TableHead>
                            <TableHead>Sent</TableHead>
                            <TableHead>Suppressed</TableHead>
                            <TableHead>Failed</TableHead>
                            <TableHead>Created</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {campaigns.map((c) => (
                            <TableRow key={c.id}>
                                <TableCell className="font-medium">{c.name}</TableCell>
                                <TableCell><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TableCell>
                                <TableCell>{c.total_recipients}</TableCell>
                                <TableCell>{c.counts?.sent ?? 0}</TableCell>
                                <TableCell className="text-muted-foreground">{c.counts?.suppressed ?? 0}</TableCell>
                                <TableCell className="text-muted-foreground">{c.counts?.failed ?? 0}</TableCell>
                                <TableCell className="text-muted-foreground">{c.created_at.slice(0, 19)}</TableCell>
                            </TableRow>
                        ))}
                        {campaigns.length === 0 && (
                            <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No campaigns yet.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                    <DialogHeader><DialogTitle>New campaign</DialogTitle></DialogHeader>
                    {draft && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Name</Label>
                                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="July product update" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Category (for opt-outs)</Label>
                                    <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Content</Label>
                                <Select value={draft.mode} onValueChange={(v) => setDraft({ ...draft, mode: v as Mode })}>
                                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="template">Use a saved marketing template</SelectItem>
                                        <SelectItem value="compose">Compose inline</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {draft.mode === 'template' ? (
                                <div className="space-y-1.5">
                                    <Label>Template</Label>
                                    <Select value={draft.template_id} onValueChange={(v) => setDraft({ ...draft, template_id: v })}>
                                        <SelectTrigger className="h-10"><SelectValue placeholder="Pick a marketing template" /></SelectTrigger>
                                        <SelectContent>
                                            {templates.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No marketing templates — create one in Templates</div>}
                                            {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.key}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1.5">
                                        <Label>Subject (Liquid)</Label>
                                        <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Body (Liquid + HTML)</Label>
                                        <Textarea className="min-h-[160px] font-mono text-xs" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                                    </div>
                                    <div className="rounded-lg border p-3">
                                        <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Call-to-action (optional)</Label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Input placeholder="Primary label" value={draft.cta?.primary?.label ?? ''} onChange={(e) => setCta('primary', 'label', e.target.value)} />
                                            <Input placeholder="Primary URL" value={draft.cta?.primary?.url ?? ''} onChange={(e) => setCta('primary', 'url', e.target.value)} />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="rounded-md bg-muted/50 p-3 text-sm">
                                This will send to <strong>~{audience}</strong> subscriber(s) with an email. Suppressed and
                                opted-out recipients are skipped automatically.
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
                        <Button onClick={send} disabled={sending}>
                            <Send className="mr-1.5 h-4 w-4" /> {sending ? 'Queuing…' : 'Send campaign'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
