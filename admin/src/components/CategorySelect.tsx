import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CREATE = '__create__';

// A category picker: a dropdown of known categories plus a "New category…" option that
// flips to a free-text input. Shared by workflows and campaigns.
export default function CategorySelect({
    value,
    onChange,
    categories,
}: {
    value: string;
    onChange: (v: string) => void;
    categories: string[];
}) {
    const [creating, setCreating] = useState(false);
    const known = Array.from(new Set([...categories, value].filter(Boolean)));

    if (creating) {
        return (
            <div className="flex gap-2">
                <Input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder="new-category" />
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
                    Pick existing
                </Button>
            </div>
        );
    }

    return (
        <Select
            value={value || undefined}
            onValueChange={(v) => {
                if (v === CREATE) {
                    onChange('');
                    setCreating(true);
                } else {
                    onChange(v);
                }
            }}
        >
            <SelectTrigger className="h-10"><SelectValue placeholder="Select a category" /></SelectTrigger>
            <SelectContent>
                {known.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                <SelectItem value={CREATE}>＋ New category…</SelectItem>
            </SelectContent>
        </Select>
    );
}
