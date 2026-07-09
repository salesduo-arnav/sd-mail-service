import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, KeyRound, Copy, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { productsApi } from '@/services';
import { useProducts } from '@/contexts/ProductContext';
import { slugify } from '@/lib/slugify';
import type { ApiKeyRow, Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

const empty: Partial<Product> = { slug: '', name: '', from_email: '', brand_color: '#ff9900' };

export default function Products() {
    const { products, refresh } = useProducts();
    const [editing, setEditing] = useState<Partial<Product> | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
    const [keysFor, setKeysFor] = useState<Product | null>(null);
    // Track whether the slug was hand-edited so typing a name doesn't clobber it.
    const [slugEdited, setSlugEdited] = useState(false);
    const [slugEditing, setSlugEditing] = useState(false);
    const [showBranding, setShowBranding] = useState(false);

    const openEditor = (p?: Product) => {
        setSlugEdited(!!p); // existing products keep their slug
        setSlugEditing(false);
        setShowBranding(false);
        setEditing(p ? { ...p } : { ...empty });
    };

    const onName = (name: string) => {
        setEditing((prev) => (prev ? { ...prev, name, slug: slugEdited ? prev.slug : slugify(name) } : prev));
    };

    const save = async () => {
        if (!editing) return;
        if (!editing.name?.trim() || !editing.from_email?.trim()) {
            toast.error('Name and from email are required');
            return;
        }
        setSaving(true);
        try {
            // Autofill the derivable fields so the user never has to.
            const payload = {
                ...editing,
                slug: editing.slug || slugify(editing.name),
                brand_name: editing.brand_name || editing.name,
            };
            if (editing.id) await productsApi.update(editing.id, payload);
            else await productsApi.create(payload);
            toast.success('Product saved');
            setEditing(null);
            await refresh();
        } finally {
            setSaving(false);
        }
    };

    const del = async () => {
        if (!deleteTarget) return;
        await productsApi.remove(deleteTarget.id);
        toast.success('Product deleted');
        setDeleteTarget(null);
        await refresh();
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Products</h1>
                    <p className="text-sm text-muted-foreground">Consuming platforms — branding, sending identity, and API keys.</p>
                </div>
                <Button onClick={() => openEditor()}>
                    <Plus className="mr-1.5 h-4 w-4" /> New product
                </Button>
            </div>

            <div className="rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Slug</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>From</TableHead>
                            <TableHead className="w-[1%]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map((p) => (
                            <TableRow key={p.id}>
                                <TableCell className="font-mono text-sm">{p.slug}</TableCell>
                                <TableCell>{p.name}</TableCell>
                                <TableCell className="text-muted-foreground">{p.from_email}</TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setKeysFor(p)} title="API keys">
                                            <KeyRound className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(p)} title="Edit">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive"
                                            onClick={() => setDeleteTarget(p)}
                                            title="Delete"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {products.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                                    No products yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Create / edit dialog */}
            <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editing?.id ? 'Edit product' : 'New product'}</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Name" required htmlFor="p-name">
                                <Input id="p-name" value={editing.name ?? ''} onChange={(e) => onName(e.target.value)} placeholder="Creative Studio" />
                            </Field>
                            <Field label="From email" required htmlFor="p-from" info={'The sender recipients see. Format: "Brand" <no-reply@you.com>.'}>
                                <Input id="p-from" value={editing.from_email ?? ''} onChange={(e) => setEditing({ ...editing, from_email: e.target.value })} placeholder='"Creative Studio" <no-reply@salesduo.com>' />
                            </Field>

                            <div className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                                <span>Slug:</span>
                                {slugEditing ? (
                                    <Input
                                        className="h-8 max-w-xs"
                                        value={editing.slug ?? ''}
                                        onChange={(e) => {
                                            setSlugEdited(true);
                                            setEditing({ ...editing, slug: e.target.value });
                                        }}
                                    />
                                ) : (
                                    <code className="font-mono text-foreground">{editing.slug || '—'}</code>
                                )}
                                {!slugEditing && (
                                    <button type="button" className="text-primary hover:underline" onClick={() => setSlugEditing(true)}>
                                        Edit
                                    </button>
                                )}
                                <span className="text-xs">Stable id used in APIs and URLs; auto-derived from the name.</span>
                            </div>

                            <div className="col-span-2">
                                <button
                                    type="button"
                                    className="flex items-center gap-1.5 text-sm font-medium"
                                    onClick={() => setShowBranding(!showBranding)}
                                >
                                    {showBranding ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    Branding (optional)
                                </button>
                                {showBranding && (
                                    <>
                                        <p className="mb-3 mt-1 text-xs text-muted-foreground">Applied to every email's layout, footer, and buttons.</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Brand name (optional)" htmlFor="p-brand" info="Shown in the email footer and usable as {{ brand_name }}. Default: the product name.">
                                                <Input id="p-brand" value={editing.brand_name ?? ''} onChange={(e) => setEditing({ ...editing, brand_name: e.target.value })} placeholder={editing.name || 'Creative Studio'} />
                                            </Field>
                                            <Field label="Brand color (optional)" info="Colors the call-to-action buttons; usable as {{ brand_color }}. Default: #ff9900.">
                                                <div className="flex gap-2">
                                                    <input
                                                        type="color"
                                                        className="h-10 w-12 rounded-md border"
                                                        value={editing.brand_color ?? '#ff9900'}
                                                        onChange={(e) => setEditing({ ...editing, brand_color: e.target.value })}
                                                    />
                                                    <Input value={editing.brand_color ?? ''} onChange={(e) => setEditing({ ...editing, brand_color: e.target.value })} placeholder="#ff9900" />
                                                </div>
                                            </Field>
                                            <Field label="Reply-to email (optional)" htmlFor="p-replyto" info="Where replies go, and the support contact shown in the footer.">
                                                <Input id="p-replyto" value={editing.reply_to_email ?? ''} onChange={(e) => setEditing({ ...editing, reply_to_email: e.target.value })} placeholder="support@you.com" />
                                            </Field>
                                            <Field label="Logo URL (optional)" htmlFor="p-logo" info="Available in a custom layout as {{ logo_url }}; only appears if your layout HTML uses it.">
                                                <Input id="p-logo" value={editing.logo_url ?? ''} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })} placeholder="https://…/logo.png" />
                                            </Field>
                                            <Field label="Layout HTML (optional)" full htmlFor="p-layout" info="Custom HTML wrapper for every email; must contain {{ content }} where the body is injected. A default is used if blank.">
                                                <Textarea
                                                    id="p-layout"
                                                    className="font-mono text-xs"
                                                    rows={6}
                                                    value={editing.layout_html ?? ''}
                                                    onChange={(e) => setEditing({ ...editing, layout_html: e.target.value })}
                                                />
                                            </Field>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {keysFor && <KeysDialog product={keysFor} onClose={() => setKeysFor(null)} />}

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete “{deleteTarget?.slug}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently removes the product and everything scoped to it (keys, subscribers, workflows, templates, logs).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={del}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function KeysDialog({ product, onClose }: { product: Product; onClose: () => void }) {
    const [keys, setKeys] = useState<ApiKeyRow[]>([]);
    const [name, setName] = useState('');
    const [reveal, setReveal] = useState('');

    const load = () => productsApi.get(product.id).then((r) => setKeys(r.api_keys));
    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const create = async () => {
        const r = await productsApi.createKey(product.id, name || 'api key');
        setReveal(r.api_key);
        setName('');
        load();
    };
    const revoke = async (id: string) => {
        await productsApi.revokeKey(product.id, id);
        load();
    };
    const show = async (id: string) => {
        const r = await productsApi.revealKey(product.id, id);
        setReveal(r.api_key);
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>API keys — {product.slug}</DialogTitle>
                </DialogHeader>
                {reveal && (
                    <div className="flex items-center gap-2 rounded-md bg-green-50 p-2 text-sm text-green-800">
                        <code className="flex-1 break-all font-mono text-xs">{reveal}</code>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(reveal); toast.success('Copied'); }}>
                            <Copy className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}
                <p className="text-xs text-muted-foreground">
                    Keys are shown at creation and can be revealed here (stored encrypted at rest; the hash is used for
                    auth). Keys created before this feature can't be revealed — rotate them.
                </p>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Last used</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[1%]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {keys.map((k) => (
                            <TableRow key={k.id}>
                                <TableCell>{k.name}</TableCell>
                                <TableCell className="text-muted-foreground">{k.last_used_at?.slice(0, 19) ?? '—'}</TableCell>
                                <TableCell>
                                    {k.revoked_at ? <Badge variant="secondary">revoked</Badge> : <Badge>active</Badge>}
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-1">
                                        {k.revealable && !k.revoked_at && (
                                            <Button size="sm" variant="ghost" onClick={() => show(k.id)}>
                                                <Eye className="mr-1.5 h-3.5 w-3.5" /> Show
                                            </Button>
                                        )}
                                        {!k.revoked_at && (
                                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revoke(k.id)}>
                                                Revoke
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="space-y-1.5">
                    <Label htmlFor="key-name">New key name</Label>
                    <div className="flex gap-2">
                        <Input id="key-name" placeholder="e.g. production" value={name} onChange={(e) => setName(e.target.value)} />
                        <Button onClick={create}>
                            <Plus className="mr-1.5 h-4 w-4" /> Create
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
