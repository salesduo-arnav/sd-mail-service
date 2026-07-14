// Maps a message / run / campaign status to a Badge variant. Superset shared by
// the Logs, Campaigns, and Subscribers tables.
export function statusVariant(status: string): 'default' | 'destructive' | 'secondary' {
    if (['sent', 'delivered', 'completed', 'active'].includes(status)) return 'default';
    if (['suppressed', 'failed', 'bounced', 'complained', 'canceled'].includes(status)) return 'destructive';
    return 'secondary';
}
