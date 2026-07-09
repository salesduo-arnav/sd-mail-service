import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { LIQUID_VARIABLES, type LiquidVariableSource } from '@/lib/options';

const GROUPS: { key: LiquidVariableSource; title: string }[] = [
    { key: 'producer', title: 'Supplied by the producing service' },
    { key: 'subscriber', title: 'From the subscriber' },
    { key: 'brand', title: 'Derived / branding' },
];

const EXAMPLE = `POST /v1/events
{
  "subscriber": { "name": "Ada Lovelace", "email": "ada@x.com",
                  "attributes": { "plan": "pro" } },
  "data": { "invoice_url": "https://…" }
}
// → {{ first_name }} = Ada   {{ subscriber.email }} = ada@x.com
// → {{ attributes.plan }} = pro   {{ data.invoice_url }} = https://…`;

// Collapsible in-panel reference explaining every Liquid variable a template can use and
// how a producing service supplies them. Embedded in the template + campaign editors.
export default function LiquidVariablesReference() {
    const [open, setOpen] = useState(false);

    const copy = (name: string) => {
        navigator.clipboard.writeText(`{{ ${name} }}`);
        toast.success(`Copied {{ ${name} }}`);
    };

    return (
        <div className="rounded-lg border">
            <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium"
                onClick={() => setOpen(!open)}
            >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Template variables you can use
            </button>
            {open && (
                <div className="space-y-4 border-t px-3 py-3 text-sm">
                    {GROUPS.map((g) => (
                        <div key={g.key} className="space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
                            {LIQUID_VARIABLES.filter((v) => v.source === g.key).map((v) => (
                                <div key={v.name} className="flex items-start gap-2">
                                    <button
                                        type="button"
                                        onClick={() => copy(v.name)}
                                        className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs hover:bg-muted/70"
                                        title="Copy"
                                    >
                                        {`{{ ${v.name} }}`}
                                        <Copy className="h-3 w-3" />
                                    </button>
                                    <span className="text-muted-foreground">{v.description}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                    <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
                        <p className="mb-1 font-medium text-foreground">How other services supply these</p>
                        <p>A producer calls the API with the subscriber and a free-form <code>data</code> payload; each field becomes a variable:</p>
                        <pre className="mt-1.5 overflow-x-auto rounded bg-background p-2 font-mono text-[11px] leading-relaxed">{EXAMPLE}</pre>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Unknown variables render as blank. Marketing emails get an unsubscribe footer automatically.
                    </p>
                </div>
            )}
        </div>
    );
}
