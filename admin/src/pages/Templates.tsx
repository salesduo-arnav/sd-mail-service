import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Eye, Send } from 'lucide-react';
import { templatesApi } from '@/services';
import { useProducts } from '@/contexts/ProductContext';
import { MESSAGE_TYPE_OPTIONS } from '@/lib/options';
import type { MessageType, Template } from '@/types';
import LiquidVariablesReference from '@/components/LiquidVariablesReference';
import CtaEditor from '@/components/CtaEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ConfirmDelete } from '@/components/ConfirmDelete';

type Editing = Partial<Template> & { sampleData?: string };

const emptyTpl: Editing = {
    key: '',
    type: 'marketing',
    subject: '',
    body: '',
    cta: null,
    sampleData: '{\n  "name": "Jane Doe"\n}',
};

export default function Templates() {
    const { productId } = useProducts();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
    const [testTo, setTestTo] = useState<string | null>(null);

    const load = useCallback(() => {
        if (!productId) return;
        templatesApi.list(productId).then(setTemplates);
    }, [productId]);
    useEffect(load, [load]);

    const parseData = (e: Editing): Record<string, unknown> => {
        try {
            return JSON.parse(e.sampleData || '{}');
        } catch {
            return {};
        }
    };

    const buildPayload = (e: Editing) => ({
        product_id: productId,
        key: e.key || '',
        type: (e.type || 'marketing') as MessageType,
        subject: e.subject ?? '',
        body: e.body ?? '',
        cta: e.cta ?? null,
    });

    const save = async () => {
        if (!editing) return;
        if (!editing.key) {
            toast.error('Template key is required');
            return;
        }
        setSaving(true);
        try {
            const payload = buildPayload(editing);
            if (editing.id) await templatesApi.update(editing.id, payload);
            else await templatesApi.create(payload);
            toast.success('Template saved');
            setEditing(null);
            load();
        } finally {
            setSaving(false);
        }
    };

    const doPreview = async () => {
        if (!editing) return;
        const p = buildPayload(editing);
        const r = await templatesApi.preview({
            product_id: productId,
            subject: p.subject,
            body: p.body,
            cta: p.cta,
            type: p.type,
            data: parseData(editing),
        });
        setPreview(r);
    };

    const sendTest = async () => {
        if (!editing?.id || !testTo) return;
        await templatesApi.sendTest(editing.id, testTo, parseData(editing));
        toast.success(`Test sent to ${testTo}`);
        setTestTo(null);
    };

    const del = async () => {
        if (!deleteTarget) return;
        await templatesApi.remove(deleteTarget.id);
        toast.success('Template deleted');
        setDeleteTarget(null);
        load();
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Templates</h1>
                    <p className="text-sm text-muted-foreground">Email content (Liquid). Marketing carries an unsubscribe footer; transactional does not.</p>
                </div>
                <Button onClick={() => setEditing({ ...emptyTpl })} disabled={!productId}>
                    <Plus className="mr-1.5 h-4 w-4" /> New template
                </Button>
            </div>

            <div className="rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Key</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead className="w-[1%]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {templates.map((t) => (
                            <TableRow key={t.id}>
                                <TableCell className="font-mono text-sm">{t.key}</TableCell>
                                <TableCell>
                                    <Badge variant={t.type === 'transactional' ? 'outline' : 'secondary'}>{t.type}</Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{t.subject}</TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ ...t, sampleData: emptyTpl.sampleData })} title="Edit">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(t)} title="Delete">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {templates.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No templates yet.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing?.id ? `Edit template · ${editing.key}` : 'New template'}</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Key" required htmlFor="tpl-key" info="Referenced by workflows, campaigns, and the API. Can't change later.">
                                    <Input id="tpl-key" value={editing.key ?? ''} disabled={!!editing.id} onChange={(e) => setEditing({ ...editing, key: e.target.value })} placeholder="welcome" />
                                </Field>
                                <Field label="Type" info={MESSAGE_TYPE_OPTIONS.find((o) => o.value === editing.type)?.description}>
                                    <Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v as MessageType })}>
                                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {MESSAGE_TYPE_OPTIONS.map((o) => (
                                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            </div>

                            <Field label="Subject" htmlFor="tpl-subject" info="Supports Liquid, e.g. Welcome, {{ first_name }}!">
                                <Input id="tpl-subject" value={editing.subject ?? ''} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} placeholder="Welcome, {{ first_name }}!" />
                            </Field>
                            <Field label="Body" htmlFor="tpl-body" info="Liquid + HTML. Wrapped in the product's layout when sent.">
                                <Textarea id="tpl-body" className="min-h-[180px] font-mono text-xs" value={editing.body ?? ''} onChange={(e) => setEditing({ ...editing, body: e.target.value })} placeholder="<p>Hi {{ first_name }},</p>" />
                            </Field>

                            <LiquidVariablesReference />

                            <CtaEditor value={editing.cta ?? null} onChange={(cta) => setEditing({ ...editing, cta })} />

                            <Field label="Sample data (optional)" info="JSON used only to fill variables in Preview and Send test.">
                                <Textarea className="min-h-[70px] font-mono text-xs" value={editing.sampleData ?? '{}'} onChange={(e) => setEditing({ ...editing, sampleData: e.target.value })} />
                            </Field>
                        </div>
                    )}
                    <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={doPreview}><Eye className="mr-1.5 h-4 w-4" /> Preview</Button>
                            <Button variant="outline" onClick={() => setTestTo('')} disabled={!editing?.id}><Send className="mr-1.5 h-4 w-4" /> Send test</Button>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                    <SheetHeader><SheetTitle>Preview · {preview?.subject}</SheetTitle></SheetHeader>
                    {/* sandbox (no allow-scripts) so admin-authored HTML can't execute in the admin origin */}
                    <iframe title="preview" sandbox="" className="mt-4 h-[80vh] w-full rounded-md border" srcDoc={preview?.html ?? ''} />
                </SheetContent>
            </Sheet>

            <Dialog open={testTo !== null} onOpenChange={(o) => !o && setTestTo(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Send a test email</DialogTitle></DialogHeader>
                    <Field label="Recipient" htmlFor="test-to" info="Renders with the sample data above.">
                        <Input id="test-to" type="email" value={testTo ?? ''} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
                    </Field>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTestTo(null)}>Cancel</Button>
                        <Button onClick={sendTest} disabled={!testTo}>Send</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDelete
                open={!!deleteTarget}
                onOpenChange={(o) => !o && setDeleteTarget(null)}
                title={`Delete “${deleteTarget?.key}”?`}
                description="Workflows that reference this template by key will fail to send until fixed."
                onConfirm={del}
            />
        </div>
    );
}
