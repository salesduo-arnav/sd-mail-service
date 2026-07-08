import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, History } from 'lucide-react';
import { workflowsApi, templatesApi, catalogApi } from '@/services';
import { useProducts } from '@/contexts/ProductContext';
import type { Audience, Step, Workflow, WorkflowVersion } from '@/types';
import StepBuilder from '@/components/StepBuilder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

interface Editing {
    id?: string;
    key: string;
    name: string;
    trigger_event_key: string;
    category: string;
    audience: Audience;
    steps: Step[];
}

const emptyWf: Editing = {
    key: '',
    name: '',
    trigger_event_key: '',
    category: 'onboarding',
    audience: 'event_subscriber',
    steps: [],
};

export default function Workflows() {
    const { productId } = useProducts();
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [templateKeys, setTemplateKeys] = useState<string[]>([]);
    const [eventKeys, setEventKeys] = useState<string[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
    const [historyFor, setHistoryFor] = useState<Workflow | null>(null);

    const load = useCallback(() => {
        if (!productId) return;
        workflowsApi.list(productId).then(setWorkflows);
        templatesApi.list(productId).then((ts) => setTemplateKeys(ts.map((t) => t.key)));
        catalogApi.events(productId).then(setEventKeys);
        catalogApi.categories(productId).then(setCategories);
    }, [productId]);
    useEffect(load, [load]);

    const openEdit = async (w: Workflow) => {
        const detail = await workflowsApi.get(w.id);
        setEditing({
            id: w.id,
            key: w.key,
            name: w.name,
            trigger_event_key: w.trigger_event_key,
            category: w.category,
            audience: w.audience,
            steps: detail.active_version?.steps ?? [],
        });
    };

    const save = async () => {
        if (!editing) return;
        if (!editing.key || !editing.name || !editing.trigger_event_key) {
            toast.error('Key, name and trigger are required');
            return;
        }
        setSaving(true);
        try {
            if (editing.id) {
                await workflowsApi.update(editing.id, {
                    name: editing.name,
                    trigger_event_key: editing.trigger_event_key,
                    category: editing.category,
                    audience: editing.audience,
                    steps: editing.steps,
                });
            } else {
                await workflowsApi.create({ product_id: productId, ...editing });
            }
            toast.success(editing.id ? 'Saved as a new version' : 'Workflow created');
            setEditing(null);
            load();
        } finally {
            setSaving(false);
        }
    };

    const toggle = async (w: Workflow) => {
        await workflowsApi.toggle(w.id, !w.enabled);
        load();
    };
    const del = async () => {
        if (!deleteTarget) return;
        await workflowsApi.remove(deleteTarget.id);
        toast.success('Workflow deleted');
        setDeleteTarget(null);
        load();
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Workflows</h1>
                    <p className="text-sm text-muted-foreground">Event-triggered automations. Editing steps creates a new version; in-flight runs keep theirs.</p>
                </div>
                <Button onClick={() => setEditing({ ...emptyWf })} disabled={!productId}>
                    <Plus className="mr-1.5 h-4 w-4" /> New workflow
                </Button>
            </div>

            <div className="rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Key</TableHead>
                            <TableHead>Trigger</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Audience</TableHead>
                            <TableHead>Enabled</TableHead>
                            <TableHead className="w-[1%]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {workflows.map((w) => (
                            <TableRow key={w.id}>
                                <TableCell className="font-mono text-sm">{w.key}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">{w.trigger_event_key}</TableCell>
                                <TableCell><Badge variant="secondary">{w.category}</Badge></TableCell>
                                <TableCell className="text-sm">{w.audience}</TableCell>
                                <TableCell><Switch checked={w.enabled} onCheckedChange={() => toggle(w)} /></TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHistoryFor(w)} title="Version history">
                                            <History className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(w)} title="Edit">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(w)} title="Delete">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {workflows.length === 0 && (
                            <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No workflows yet.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Create / edit */}
            <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing?.id ? `Edit workflow · ${editing.key}` : 'New workflow'}</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Key</Label>
                                    <Input value={editing.key} disabled={!!editing.id} onChange={(e) => setEditing({ ...editing, key: e.target.value })} placeholder="welcome" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Name</Label>
                                    <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Trigger event key</Label>
                                    <Input list="trigger-catalog" value={editing.trigger_event_key} onChange={(e) => setEditing({ ...editing, trigger_event_key: e.target.value })} placeholder="creative_studio.trial_started" />
                                    <datalist id="trigger-catalog">{eventKeys.map((k) => <option key={k} value={k} />)}</datalist>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Category</Label>
                                        <Input list="cat-catalog" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                                        <datalist id="cat-catalog">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Audience</Label>
                                        <Select value={editing.audience} onValueChange={(v) => setEditing({ ...editing, audience: v as Audience })}>
                                            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="event_subscriber">event_subscriber</SelectItem>
                                                <SelectItem value="org_owner">org_owner</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <Label className="mb-2 block">Steps</Label>
                                <StepBuilder value={editing.steps} onChange={(steps) => setEditing({ ...editing, steps })} templates={templateKeys} eventKeys={eventKeys} />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : editing?.id ? 'Save new version' : 'Create'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {historyFor && <HistoryDialog workflow={historyFor} onClose={() => setHistoryFor(null)} onChanged={load} />}

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete “{deleteTarget?.key}”?</AlertDialogTitle>
                        <AlertDialogDescription>Removes the workflow, its versions and runs. Sent messages are kept.</AlertDialogDescription>
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

function HistoryDialog({ workflow, onClose, onChanged }: { workflow: Workflow; onClose: () => void; onChanged: () => void }) {
    const [versions, setVersions] = useState<WorkflowVersion[]>([]);
    const [activeId, setActiveId] = useState<string | null>(workflow.active_version_id);
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = () => workflowsApi.get(workflow.id).then((r) => { setVersions(r.versions); setActiveId(r.workflow.active_version_id); });
    useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    const activate = async (v: WorkflowVersion) => {
        await workflowsApi.activateVersion(workflow.id, v.id);
        toast.success(`Activated version ${v.version}`);
        load();
        onChanged();
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                <DialogHeader><DialogTitle>Version history — {workflow.key}</DialogTitle></DialogHeader>
                <div className="space-y-2">
                    {versions.map((v) => (
                        <div key={v.id} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge variant={v.id === activeId ? 'default' : 'secondary'}>v{v.version}</Badge>
                                    {v.id === activeId && <span className="text-xs text-primary">active</span>}
                                    <span className="text-xs text-muted-foreground">{v.created_at?.slice(0, 19)}</span>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
                                        {expanded === v.id ? 'Hide' : 'View steps'}
                                    </Button>
                                    {v.id !== activeId && <Button variant="outline" size="sm" onClick={() => activate(v)}>Activate</Button>}
                                </div>
                            </div>
                            {expanded === v.id && (
                                <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(v.steps, null, 2)}</pre>
                            )}
                        </div>
                    ))}
                    {versions.length === 0 && <p className="text-sm text-muted-foreground">No versions.</p>}
                </div>
            </DialogContent>
        </Dialog>
    );
}
