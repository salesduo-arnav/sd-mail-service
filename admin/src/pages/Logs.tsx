import { useCallback, useEffect, useState } from 'react';
import { logsApi } from '@/services';
import { useProducts } from '@/contexts/ProductContext';
import { SUPPRESSION_REASON_OPTIONS } from '@/lib/options';
import type { Message, Metrics, RunStep, Suppression, WorkflowRun } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

function Stat({ label, value }: { label: string; value: string | number }) {
    return (
        <Card>
            <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-2xl font-semibold">{value}</CardContent>
        </Card>
    );
}

const reasonLabel = (reason: string) => SUPPRESSION_REASON_OPTIONS.find((o) => o.value === reason)?.label ?? reason;

const badgeVariant = (s: string) =>
    s === 'sent' || s === 'delivered' || s === 'completed' || s === 'active'
        ? 'default'
        : s === 'suppressed' || s === 'failed' || s === 'bounced' || s === 'canceled'
          ? 'destructive'
          : 'secondary';

export default function Logs() {
    const { productId } = useProducts();
    const [m, setM] = useState<Metrics | null>(null);
    const [tab, setTab] = useState('messages');
    const [messages, setMessages] = useState<Message[]>([]);
    const [events, setEvents] = useState<Record<string, unknown>[]>([]);
    const [runs, setRuns] = useState<WorkflowRun[]>([]);
    const [suppressions, setSuppressions] = useState<Suppression[]>([]);
    const [msgStatus, setMsgStatus] = useState('');
    const [msgType, setMsgType] = useState('');
    const [runDetail, setRunDetail] = useState<{ run: WorkflowRun; steps: RunStep[]; messages: Message[] } | null>(null);

    const loadTab = useCallback(() => {
        if (!productId) return;
        if (tab === 'messages') logsApi.messages(productId, msgStatus, msgType).then(setMessages);
        else if (tab === 'events') logsApi.events(productId).then(setEvents);
        else if (tab === 'runs') logsApi.runs(productId).then(setRuns);
        else if (tab === 'suppressions') logsApi.suppressions(productId).then(setSuppressions);
    }, [productId, tab, msgStatus, msgType]);

    useEffect(() => {
        if (productId) logsApi.metrics(productId).then(setM);
    }, [productId]);
    useEffect(loadTab, [loadTab]);

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-semibold">Logs &amp; analytics</h1>
                <p className="text-sm text-muted-foreground">Delivery, events, runs and suppressions for the selected product.</p>
            </div>

            {m && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Stat label="Events" value={m.events} />
                    <Stat label="Sent" value={m.messages_by_status.sent ?? 0} />
                    <Stat label="Suppressed" value={m.messages_by_status.suppressed ?? 0} />
                    <Stat label="Active runs" value={m.runs_by_status.active ?? 0} />
                    <Stat label="Txn success" value={m.transactional_success_rate == null ? '—' : `${Math.round(m.transactional_success_rate * 100)}%`} />
                </div>
            )}

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    <TabsTrigger value="messages">Messages</TabsTrigger>
                    <TabsTrigger value="events">Events</TabsTrigger>
                    <TabsTrigger value="runs">Runs</TabsTrigger>
                    <TabsTrigger value="suppressions">Suppressions</TabsTrigger>
                </TabsList>

                <TabsContent value="messages" className="space-y-3">
                    <div className="flex gap-2">
                        <Select value={msgStatus || 'all'} onValueChange={(v) => setMsgStatus(v === 'all' ? '' : v)}>
                            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="status" /></SelectTrigger>
                            <SelectContent>
                                {['all', 'sent', 'delivered', 'suppressed', 'failed', 'bounced', 'queued'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={msgType || 'all'} onValueChange={(v) => setMsgType(v === 'all' ? '' : v)}>
                            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="type" /></SelectTrigger>
                            <SelectContent>
                                {['all', 'marketing', 'transactional'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <DataCard>
                        <Table>
                            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>To</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {messages.map((x) => (
                                    <TableRow key={x.id}>
                                        <TableCell className="text-muted-foreground">{x.created_at.slice(0, 19)}</TableCell>
                                        <TableCell><Badge variant={x.type === 'transactional' ? 'outline' : 'secondary'}>{x.type}</Badge></TableCell>
                                        <TableCell><Badge variant={badgeVariant(x.status)}>{x.status}</Badge></TableCell>
                                        <TableCell className="text-muted-foreground">{x.to_email}</TableCell>
                                    </TableRow>
                                ))}
                                {messages.length === 0 && <Empty span={4} />}
                            </TableBody>
                        </Table>
                    </DataCard>
                </TabsContent>

                <TabsContent value="events">
                    <DataCard>
                        <Table>
                            <TableHeader><TableRow><TableHead>Received</TableHead><TableHead>Event key</TableHead><TableHead>Idempotency</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {events.map((x, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="text-muted-foreground">{String(x.received_at ?? '').slice(0, 19)}</TableCell>
                                        <TableCell className="font-mono text-sm">{String(x.event_key ?? '')}</TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{String(x.idempotency_key ?? '')}</TableCell>
                                    </TableRow>
                                ))}
                                {events.length === 0 && <Empty span={3} />}
                            </TableBody>
                        </Table>
                    </DataCard>
                </TabsContent>

                <TabsContent value="runs">
                    <DataCard>
                        <Table>
                            <TableHeader><TableRow><TableHead>Created</TableHead><TableHead>Status</TableHead><TableHead>Run</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {runs.map((r) => (
                                    <TableRow key={r.id} className="cursor-pointer" onClick={() => logsApi.run(r.id).then(setRunDetail)}>
                                        <TableCell className="text-muted-foreground">{r.created_at.slice(0, 19)}</TableCell>
                                        <TableCell><Badge variant={badgeVariant(r.status)}>{r.status}</Badge></TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}…</TableCell>
                                    </TableRow>
                                ))}
                                {runs.length === 0 && <Empty span={3} />}
                            </TableBody>
                        </Table>
                    </DataCard>
                </TabsContent>

                <TabsContent value="suppressions">
                    <DataCard>
                        <Table>
                            <TableHeader><TableRow><TableHead>Created</TableHead><TableHead>Email</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {suppressions.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="text-muted-foreground">{s.created_at.slice(0, 19)}</TableCell>
                                        <TableCell>{s.email}</TableCell>
                                        <TableCell><Badge variant="destructive">{reasonLabel(s.reason)}</Badge></TableCell>
                                    </TableRow>
                                ))}
                                {suppressions.length === 0 && <Empty span={3} />}
                            </TableBody>
                        </Table>
                    </DataCard>
                </TabsContent>
            </Tabs>

            <Sheet open={!!runDetail} onOpenChange={(o) => !o && setRunDetail(null)}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    {runDetail && (
                        <>
                            <SheetHeader><SheetTitle>Run {runDetail.run.id.slice(0, 8)}…</SheetTitle></SheetHeader>
                            <div className="mt-4 space-y-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <Badge variant={badgeVariant(runDetail.run.status)}>{runDetail.run.status}</Badge>
                                    <span className="text-muted-foreground">created {runDetail.run.created_at.slice(0, 19)}</span>
                                </div>
                                <section>
                                    <h4 className="mb-2 text-sm font-semibold">Steps</h4>
                                    {runDetail.steps.map((s) => (
                                        <div key={s.id} className="flex justify-between rounded-md border p-2 text-sm">
                                            <span>#{s.step_index} · {s.step_type}</span>
                                            <span className="text-muted-foreground">{s.executed_at ? `done ${s.executed_at.slice(11, 19)}` : s.scheduled_for ? `@ ${s.scheduled_for.slice(0, 19)}` : 'pending'}</span>
                                        </div>
                                    ))}
                                    {runDetail.steps.length === 0 && <p className="text-sm text-muted-foreground">No steps.</p>}
                                </section>
                                <section>
                                    <h4 className="mb-2 text-sm font-semibold">Messages</h4>
                                    {runDetail.messages.map((x) => (
                                        <div key={x.id} className="flex justify-between rounded-md border p-2 text-sm">
                                            <span className="text-muted-foreground">{x.to_email}</span>
                                            <Badge variant={badgeVariant(x.status)}>{x.status}</Badge>
                                        </div>
                                    ))}
                                    {runDetail.messages.length === 0 && <p className="text-sm text-muted-foreground">No messages.</p>}
                                </section>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}

function DataCard({ children }: { children: React.ReactNode }) {
    return <div className="rounded-lg border bg-card">{children}</div>;
}
function Empty({ span }: { span: number }) {
    return (
        <TableRow>
            <TableCell colSpan={span} className="py-8 text-center text-muted-foreground">No rows.</TableCell>
        </TableRow>
    );
}
