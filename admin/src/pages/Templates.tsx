import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Eye, Send } from 'lucide-react';
import { templatesApi, workflowsApi } from '@/services';
import { useProducts } from '@/contexts/ProductContext';
import type { Channel, MessageType, Template, TemplateCta, Workflow } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Editing = Partial<Template> & { sampleData?: string };

const emptyTpl: Editing = {
    key: '',
    type: 'marketing',
    channel: 'email',
    workflow_id: null,
    subject: '',
    body: '',
    cta: null,
    variables: [],
    sampleData: '{\n  "name": "Jane Doe",\n  "otp": "123456"\n}',
};

export default function Templates() {
    const { productId } = useProducts();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

    const load = useCallback(() => {
        if (!productId) return;
        templatesApi.list(productId).then(setTemplates);
        workflowsApi.list(productId).then(setWorkflows);
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
        channel: (e.channel || 'email') as Channel,
        workflow_id: e.workflow_id ?? null,
        subject: e.subject ?? '',
        body: e.body ?? '',
        cta: e.cta ?? null,
        variables: e.variables ?? null,
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
        if (!editing?.id) return;
        const to = prompt('Send test to which email?', 'admin@salesduo.com');
        if (!to) return;
        await templatesApi.sendTest(editing.id, to, parseData(editing));
        toast.success(`Test sent to ${to}`);
    };

    const del = async () => {
        if (!deleteTarget) return;
        await templatesApi.remove(deleteTarget.id);
        toast.success('Template deleted');
        setDeleteTarget(null);
        load();
    };

    const setCta = (which: 'primary' | 'secondary', field: 'label' | 'url', v: string) => {
        if (!editing) return;
        const cta: TemplateCta = { ...(editing.cta ?? {}) };
        cta[which] = { label: cta[which]?.label ?? '', url: cta[which]?.url ?? '', [field]: v };
        setEditing({ ...editing, cta });
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
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Key</Label>
                                    <Input value={editing.key ?? ''} disabled={!!editing.id} onChange={(e) => setEditing({ ...editing, key: e.target.value })} placeholder="welcome" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Type</Label>
                                    <Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v as MessageType })}>
                                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="marketing">marketing</SelectItem>
                                            <SelectItem value="transactional">transactional</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Channel</Label>
                                    <Select value={editing.channel} onValueChange={(v) => setEditing({ ...editing, channel: v as Channel })}>
                                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {['email', 'slack', 'in_app', 'sms'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Linked workflow (optional)</Label>
                                <Select
                                    value={editing.workflow_id ?? 'none'}
                                    onValueChange={(v) => setEditing({ ...editing, workflow_id: v === 'none' ? null : v })}
                                >
                                    <SelectTrigger className="h-10"><SelectValue placeholder="none" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">none</SelectItem>
                                        {workflows.map((w) => <SelectItem key={w.id} value={w.id}>{w.key}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Subject (Liquid)</Label>
                                <Input value={editing.subject ?? ''} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Body (Liquid + HTML)</Label>
                                <Textarea className="min-h-[180px] font-mono text-xs" value={editing.body ?? ''} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
                            </div>

                            <div className="rounded-lg border p-3">
                                <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Call-to-action buttons</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input placeholder="Primary label" value={editing.cta?.primary?.label ?? ''} onChange={(e) => setCta('primary', 'label', e.target.value)} />
                                    <Input placeholder="Primary URL (Liquid ok)" value={editing.cta?.primary?.url ?? ''} onChange={(e) => setCta('primary', 'url', e.target.value)} />
                                    <Input placeholder="Secondary label" value={editing.cta?.secondary?.label ?? ''} onChange={(e) => setCta('secondary', 'label', e.target.value)} />
                                    <Input placeholder="Secondary URL" value={editing.cta?.secondary?.url ?? ''} onChange={(e) => setCta('secondary', 'url', e.target.value)} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Declared variables (comma-separated)</Label>
                                    <Input
                                        value={(editing.variables ?? []).join(', ')}
                                        onChange={(e) => setEditing({ ...editing, variables: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                                        placeholder="otp, expires_minutes"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Sample data (JSON) for preview / test</Label>
                                    <Textarea className="min-h-[70px] font-mono text-xs" value={editing.sampleData ?? '{}'} onChange={(e) => setEditing({ ...editing, sampleData: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={doPreview}><Eye className="mr-1.5 h-4 w-4" /> Preview</Button>
                            <Button variant="outline" onClick={sendTest} disabled={!editing?.id}><Send className="mr-1.5 h-4 w-4" /> Send test</Button>
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

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete “{deleteTarget?.key}”?</AlertDialogTitle>
                        <AlertDialogDescription>Workflows that reference this template by key will fail to send until fixed.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={del}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
