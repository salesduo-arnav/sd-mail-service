import { Info } from 'lucide-react';
import type { TemplateCta } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Edits the optional primary/secondary call-to-action buttons shared by templates and
// campaigns. Button labels and URLs may both contain Liquid variables.
export default function CtaEditor({
    value,
    onChange,
}: {
    value: TemplateCta | null;
    onChange: (cta: TemplateCta) => void;
}) {
    const set = (which: 'primary' | 'secondary', field: 'label' | 'url', v: string) => {
        const next: TemplateCta = { ...(value ?? {}) };
        next[which] = { label: next[which]?.label ?? '', url: next[which]?.url ?? '', [field]: v };
        onChange(next);
    };

    return (
        <div className="rounded-lg border p-3">
            <Label className="mb-2 flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                Call-to-action buttons (optional)
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button type="button" tabIndex={0} aria-label="More info" className="hover:text-foreground">
                            <Info className="h-3.5 w-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs normal-case tracking-normal">
                        Label = button text; URL = where it links. URLs can use variables, e.g. https://app.you.com/verify?token=&#123;&#123; data.token &#125;&#125;
                    </TooltipContent>
                </Tooltip>
            </Label>
            <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Primary label" value={value?.primary?.label ?? ''} onChange={(e) => set('primary', 'label', e.target.value)} />
                <Input placeholder="https://app.you.com/invoice/{{ data.invoice_id }}" value={value?.primary?.url ?? ''} onChange={(e) => set('primary', 'url', e.target.value)} />
                <Input placeholder="Secondary label" value={value?.secondary?.label ?? ''} onChange={(e) => set('secondary', 'label', e.target.value)} />
                <Input placeholder="Secondary URL (Liquid ok)" value={value?.secondary?.url ?? ''} onChange={(e) => set('secondary', 'url', e.target.value)} />
            </div>
        </div>
    );
}
