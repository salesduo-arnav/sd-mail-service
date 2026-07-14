import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { productsApi, provisioningApi } from '@/services';
import { useProducts } from '@/contexts/ProductContext';
import { slugify } from '@/lib/slugify';
import { DEFAULT_BRAND_COLOR } from '@/lib/brand';
import { useDerivedSlug } from '@/hooks/use-derived-slug';
import type { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDelete } from '@/components/ConfirmDelete';

const empty: Partial<Product> = { slug: '', name: '', from_email: '', brand_color: DEFAULT_BRAND_COLOR };

export default function Products() {
    const { products, refresh } = useProducts();
    const [editing, setEditing] = useState<Partial<Product> | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
    const slug = useDerivedSlug();
    const [showBranding, setShowBranding] = useState(false);
    const [provisioning, setProvisioning] = useState(false);

    const provision = async () => {
        setProvisioning(true);
        try {
            const s = await provisioningApi.run();
            const created = s.products.created + s.templates.created + s.workflows.created;
            toast.success(
                created === 0
                    ? 'Catalog already provisioned — nothing to add'
                    : `Provisioned ${s.products.created} product(s), ${s.templates.created} template(s), ${s.workflows.created} workflow(s)`,
            );
            await refresh();
        } finally {
            setProvisioning(false);
        }
    };

    const openEditor = (p?: Product) => {
        slug.reset(!!p); // existing products keep their slug
        setShowBranding(false);
        setEditing(p ? { ...p } : { ...empty });
    };

    const onName = (name: string) => {
        setEditing((prev) => (prev ? { ...prev, name, slug: slug.derive(name, prev.slug ?? '') } : prev));
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
                    <p className="text-sm text-muted-foreground">Consuming platforms — branding and sending identity.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={provision} disabled={provisioning} title="Idempotently create the canonical SalesDuo products, templates, and workflows">
                        <Sparkles className="mr-1.5 h-4 w-4" /> {provisioning ? 'Provisioning…' : 'Provision catalog'}
                    </Button>
                    <Button onClick={() => openEditor()}>
                        <Plus className="mr-1.5 h-4 w-4" /> New product
                    </Button>
                </div>
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
                                {slug.editing ? (
                                    <Input
                                        className="h-8 max-w-xs"
                                        value={editing.slug ?? ''}
                                        onChange={(e) => {
                                            slug.markEdited();
                                            setEditing({ ...editing, slug: e.target.value });
                                        }}
                                    />
                                ) : (
                                    <code className="font-mono text-foreground">{editing.slug || '—'}</code>
                                )}
                                {!slug.editing && (
                                    <button type="button" className="text-primary hover:underline" onClick={() => slug.setEditing(true)}>
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
                                            <Field label="Brand color (optional)" info={`Colors the call-to-action buttons; usable as {{ brand_color }}. Default: ${DEFAULT_BRAND_COLOR}.`}>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="color"
                                                        className="h-10 w-12 rounded-md border"
                                                        value={editing.brand_color ?? DEFAULT_BRAND_COLOR}
                                                        onChange={(e) => setEditing({ ...editing, brand_color: e.target.value })}
                                                    />
                                                    <Input value={editing.brand_color ?? ''} onChange={(e) => setEditing({ ...editing, brand_color: e.target.value })} placeholder={DEFAULT_BRAND_COLOR} />
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

            <ConfirmDelete
                open={!!deleteTarget}
                onOpenChange={(o) => !o && setDeleteTarget(null)}
                title={`Delete “${deleteTarget?.slug}”?`}
                description="This permanently removes the product and everything scoped to it (subscribers, workflows, templates, logs)."
                onConfirm={del}
            />
        </div>
    );
}

