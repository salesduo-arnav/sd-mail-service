import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Send, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import { campaignsApi, templatesApi, catalogApi } from '@/services';
import { useProducts } from '@/contexts/ProductContext';
import type { Campaign, Template, TemplateCta } from '@/types';
import LiquidVariablesReference from '@/components/LiquidVariablesReference';
import CtaEditor from '@/components/CtaEditor';
import CategorySelect from '@/components/CategorySelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
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
    const [categories, setCategories] = useState<string[]>([]);
    const [audience, setAudience] = useState(0);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [sending, setSending] = useState(false);

    const load = useCallback(() => {
        if (!productId) return;
        campaignsApi.list(productId).then(setCampaigns);
        templatesApi.list(productId).then((ts) => setTemplates(ts.filter((t) => t.type === 'marketing')));
        campaignsApi.audienceCount(productId).then((r) => setAudience(r.count));
        catalogApi.categories(productId).then(setCategories);
    }, [productId]);
    useEffect(load, [load]);

    const resend = async (id: string) => {
        await campaignsApi.resend(id);
        toast.success('Re-dispatched (already-sent recipients are skipped)');
        load();
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
                            <TableHead className="w-[1%]" />
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
                                <TableCell>
                                    {(c.status !== 'sent' || (c.counts?.failed ?? 0) > 0) && (
                                        <Button variant="ghost" size="sm" onClick={() => resend(c.id)} title="Re-dispatch (retry not-yet-sent)">
                                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retry
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {campaigns.length === 0 && (
                            <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No campaigns yet.</TableCell></TableRow>
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
                                <Field label="Name" required htmlFor="cmp-name">
                                    <Input id="cmp-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="July product update" />
                                </Field>
                                <Field label="Category" info="Recipients who opted out of this category are skipped.">
                                    <CategorySelect value={draft.category} onChange={(category) => setDraft({ ...draft, category })} categories={categories} />
                                </Field>
                            </div>

                            <Field label="Content">
                                <Select value={draft.mode} onValueChange={(v) => setDraft({ ...draft, mode: v as Mode })}>
                                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="template">Use a saved marketing template</SelectItem>
                                        <SelectItem value="compose">Compose inline</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>

                            {draft.mode === 'template' ? (
                                <Field label="Template" required>
                                    <Select value={draft.template_id} onValueChange={(v) => setDraft({ ...draft, template_id: v })}>
                                        <SelectTrigger className="h-10"><SelectValue placeholder="Pick a marketing template" /></SelectTrigger>
                                        <SelectContent>
                                            {templates.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No marketing templates — create one in Templates</div>}
                                            {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.key}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            ) : (
                                <>
                                    <Field label="Subject" required htmlFor="cmp-subject" info="Supports Liquid.">
                                        <Input id="cmp-subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="What's new this month" />
                                    </Field>
                                    <Field label="Body" required htmlFor="cmp-body" info="Liquid + HTML. Wrapped in the product's layout when sent.">
                                        <Textarea id="cmp-body" className="min-h-[160px] font-mono text-xs" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                                    </Field>
                                    <LiquidVariablesReference />
                                    <CtaEditor value={draft.cta} onChange={(cta) => setDraft({ ...draft, cta })} />
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
