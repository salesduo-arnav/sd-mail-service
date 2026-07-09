import { Plus, Trash2, ArrowUp, ArrowDown, Send, Clock, Ban, Repeat } from 'lucide-react';
import type { Step, SendStep, DelayStep, CancelOnStep } from '@/types';
import { DELAY_UNIT_OPTIONS } from '@/lib/options';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const STEP_META: Record<Step['type'], { icon: typeof Send; label: string; color: string }> = {
    send: { icon: Send, label: 'Send', color: 'text-primary' },
    delay: { icon: Clock, label: 'Delay', color: 'text-blue-600' },
    cancel_on: { icon: Ban, label: 'Cancel on', color: 'text-red-600' },
    repeat: { icon: Repeat, label: 'Repeat', color: 'text-purple-600' },
};

function newStep(type: Step['type']): Step {
    switch (type) {
        case 'send':
            // channel stays email — it's the only delivered channel.
            return { type: 'send', channel: 'email', template: '' };
        case 'delay':
            return { type: 'delay', duration: '1d' };
        case 'cancel_on':
            return { type: 'cancel_on', event_keys: [] };
        case 'repeat':
            return { type: 'repeat' };
    }
}

export default function StepBuilder({
    value,
    onChange,
    templates,
    eventKeys,
}: {
    value: Step[];
    onChange: (steps: Step[]) => void;
    templates: string[];
    eventKeys: string[];
}) {
    const update = (i: number, step: Step) => onChange(value.map((s, idx) => (idx === i ? step : s)));
    const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
    const move = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= value.length) return;
        const next = [...value];
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
    };
    const add = (type: Step['type']) => onChange([...value, newStep(type)]);

    return (
        <div className="space-y-3">
            {value.length === 0 && (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No steps yet. Add a step to define what this workflow does.
                </p>
            )}

            {value.map((step, i) => {
                const meta = STEP_META[step.type];
                const Icon = meta.icon;
                return (
                    <div key={i} className="rounded-lg border bg-card p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="gap-1">
                                    <Icon className={`h-3 w-3 ${meta.color}`} />
                                    {i + 1}. {meta.label}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}>
                                    <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => move(i, 1)}
                                    disabled={i === value.length - 1}
                                >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(i)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                        {step.type === 'send' && <SendEditor step={step} templates={templates} onChange={(s) => update(i, s)} />}
                        {step.type === 'delay' && <DelayEditor step={step} onChange={(s) => update(i, s)} />}
                        {step.type === 'cancel_on' && (
                            <CancelOnEditor step={step} eventKeys={eventKeys} onChange={(s) => update(i, s)} />
                        )}
                        {step.type === 'repeat' && <RepeatEditor />}
                    </div>
                );
            })}

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Plus className="mr-1.5 h-4 w-4" /> Add step
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {(['send', 'delay', 'cancel_on', 'repeat'] as const).map((t) => {
                        const M = STEP_META[t];
                        const Icon = M.icon;
                        return (
                            <DropdownMenuItem key={t} onClick={() => add(t)}>
                                <Icon className={`mr-2 h-4 w-4 ${M.color}`} /> {M.label}
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function SendEditor({ step, templates, onChange }: { step: SendStep; templates: string[]; onChange: (s: SendStep) => void }) {
    return (
        <Field label="Template">
            <Select value={step.template} onValueChange={(v) => onChange({ ...step, template: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Pick a template" /></SelectTrigger>
                <SelectContent>
                    {templates.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No templates yet</div>}
                    {templates.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </Field>
    );
}

function DelayEditor({ step, onChange }: { step: DelayStep; onChange: (s: DelayStep) => void }) {
    const isUntil = step.duration.startsWith('until:');
    const m = /^(\d+)([smhdw])$/.exec(step.duration);
    const amount = m ? m[1] : '1';
    const unit = m ? m[2] : 'd';
    const field = isUntil ? step.duration.slice('until:'.length) : '';

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant={isUntil ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => onChange({ ...step, duration: '1d' })}
                >
                    Relative
                </Button>
                <Button
                    type="button"
                    variant={isUntil ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onChange({ ...step, duration: 'until:trial_ends_at' })}
                >
                    Until a date field
                </Button>
            </div>
            {isUntil ? (
                <Field label="Wait until this event data field" info="A timestamp in the event's data; if missing or past, sends now.">
                    <Input
                        className="h-9"
                        placeholder="trial_ends_at"
                        value={field}
                        onChange={(e) => onChange({ ...step, duration: `until:${e.target.value}` })}
                    />
                </Field>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Amount">
                        <Input
                            className="h-9"
                            type="number"
                            min={1}
                            value={amount}
                            onChange={(e) => onChange({ ...step, duration: `${e.target.value || 1}${unit}` })}
                        />
                    </Field>
                    <Field label="Unit">
                        <Select value={unit} onValueChange={(v) => onChange({ ...step, duration: `${amount}${v}` })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {DELAY_UNIT_OPTIONS.map((u) => (
                                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                </div>
            )}
        </div>
    );
}

function CancelOnEditor({
    step,
    eventKeys,
    onChange,
}: {
    step: CancelOnStep;
    eventKeys: string[];
    onChange: (s: CancelOnStep) => void;
}) {
    const addKey = (k: string) => {
        const key = k.trim();
        if (key && !step.event_keys.includes(key)) onChange({ ...step, event_keys: [...step.event_keys, key] });
    };
    return (
        <div className="space-y-2">
            <Label className="text-xs">Cancel this run if any of these events arrive</Label>
            <div className="flex flex-wrap gap-1.5">
                {step.event_keys.map((k) => (
                    <Badge key={k} variant="outline" className="gap-1">
                        {k}
                        <button
                            type="button"
                            className="ml-1 text-muted-foreground hover:text-destructive"
                            onClick={() => onChange({ ...step, event_keys: step.event_keys.filter((x) => x !== k) })}
                        >
                            ×
                        </button>
                    </Badge>
                ))}
                {step.event_keys.length === 0 && <span className="text-xs text-muted-foreground">none yet</span>}
            </div>
            <input
                list="event-catalog"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                placeholder="Type an event key and press Enter"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addKey((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                    }
                }}
            />
            <datalist id="event-catalog">
                {eventKeys.map((k) => (
                    <option key={k} value={k} />
                ))}
            </datalist>
        </div>
    );
}

function RepeatEditor() {
    // Repeat has no options: the engine re-arms the run using the preceding Delay as the interval.
    return (
        <p className="text-xs text-muted-foreground">
            Repeats the workflow from the top using the preceding <span className="font-medium">Delay</span> as the interval, until the run is canceled (e.g. a re-engagement nudge every 14 days until the user returns).
        </p>
    );
}
