import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, History } from 'lucide-react';
import { workflowsApi, templatesApi, catalogApi } from '@/services';
import { useProducts } from '@/contexts/ProductContext';
import { slugify } from '@/lib/slugify';
import { AUDIENCE_OPTIONS } from '@/lib/options';
import type { Audience, Step, Workflow, WorkflowVersion } from '@/types';
import StepBuilder from '@/components/StepBuilder';
import CategorySelect from '@/components/CategorySelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/ui/field';
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
    // Track whether the key was hand-edited so typing a name doesn't clobber it.
    const [keyEdited, setKeyEdited] = useState(false);
    const [keyEditing, setKeyEditing] = useState(false);

    const load = useCallback(() => {
        if (!productId) return;
        workflowsApi.list(productId).then(setWorkflows);
        templatesApi.list(productId).then((ts) => setTemplateKeys(ts.map((t) => t.key)));
        catalogApi.events(productId).then(setEventKeys);
        catalogApi.categories(productId).then(setCategories);
    }, [productId]);
    useEffect(load, [load]);

    const openNew = () => {
        setKeyEdited(false);
        setKeyEditing(false);
        setEditing({ ...emptyWf });
    };

    const openEdit = async (w: Workflow) => {
        const detail = await workflowsApi.get(w.id);
        setKeyEdited(true);
        setKeyEditing(false);
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

    const onName = (name: string) => {
        setEditing((prev) => (prev ? { ...prev, name, key: prev.id || keyEdited ? prev.key : slugify(name) } : prev));
    };

    const save = async () => {
        if (!editing) return;
        const key = editing.key || slugify(editing.name);
        if (!editing.name.trim() || !key || !editing.trigger_event_key.trim()) {
            toast.error('Name and trigger event are required');
            return;
        }
        if (editing.steps.length === 0) {
            toast.error('Add at least one step');
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
                await workflowsApi.create({ product_id: productId, ...editing, key });
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
                <Button onClick={openNew} disabled={!productId}>
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
                                <Field label="Name" required htmlFor="wf-name">
                                    <Input id="wf-name" value={editing.name} onChange={(e) => onName(e.target.value)} placeholder="Welcome onboarding" />
                                </Field>
                                <Field label="Trigger event" required htmlFor="wf-trigger" info="The event your product emits to start this workflow, e.g. app.trial_started.">
                                    <Input id="wf-trigger" list="trigger-catalog" value={editing.trigger_event_key} onChange={(e) => setEditing({ ...editing, trigger_event_key: e.target.value })} placeholder="app.trial_started" />
                                    <datalist id="trigger-catalog">{eventKeys.map((k) => <option key={k} value={k} />)}</datalist>
                                </Field>
                                <Field label="Category" info="Groups related emails and controls unsubscribes (subscribers opt out per category). Shown in this list and on each subscriber's preferences.">
                                    <CategorySelect value={editing.category} onChange={(category) => setEditing({ ...editing, category })} categories={categories} />
                                </Field>
                                <Field label="Send to" info="Organization owner sends to the subscriber's attributes.org_owner_email, falling back to the subscriber. Leave as Event subscriber if your product has no org system.">
                                    <Select value={editing.audience} onValueChange={(v) => setEditing({ ...editing, audience: v as Audience })}>
                                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {AUDIENCE_OPTIONS.map((o) => (
                                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>Key:</span>
                                {editing.id ? (
                                    <code className="font-mono text-foreground">{editing.key}</code>
                                ) : keyEditing ? (
                                    <Input
                                        className="h-8 max-w-xs"
                                        value={editing.key}
                                        onChange={(e) => {
                                            setKeyEdited(true);
                                            setEditing({ ...editing, key: e.target.value });
                                        }}
                                    />
                                ) : (
                                    <code className="font-mono text-foreground">{editing.key || '—'}</code>
                                )}
                                {!editing.id && !keyEditing && (
                                    <button type="button" className="text-primary hover:underline" onClick={() => setKeyEditing(true)}>
                                        Edit
                                    </button>
                                )}
                                <span className="text-xs">
                                    {editing.id ? 'Stable id; cannot change after creation.' : 'Stable id used in APIs; auto-derived from the name.'}
                                </span>
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
