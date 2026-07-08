/**
 * Parse workflow delay durations. Supports relative units (`s`,`m`,`h`,`d`,`w`)
 * and absolute scheduling via `until:<data.field>` resolved from event data.
 */

const UNIT_MS: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
};

export type ParsedDelay =
    | { kind: 'relative'; ms: number }
    | { kind: 'absolute'; at: Date | null; field: string };

export function parseDuration(duration: string): ParsedDelay {
    const d = duration.trim();
    if (d.startsWith('until:')) {
        return { kind: 'absolute', at: null, field: d.slice('until:'.length).trim() };
    }
    const m = /^(\d+)\s*([smhdw])$/.exec(d);
    if (!m) throw new Error(`Invalid duration: "${duration}"`);
    return { kind: 'relative', ms: Number(m[1]) * UNIT_MS[m[2]] };
}

/**
 * Resolve a delay to an absolute fire time from the trigger's `now` and event data.
 * `until:<field>` reads a timestamp from data; missing/past → fire now (per edge-cases doc).
 */
export function resolveFireAt(duration: string, now: Date, data: Record<string, unknown>): Date {
    const parsed = parseDuration(duration);
    if (parsed.kind === 'relative') return new Date(now.getTime() + parsed.ms);

    const raw = data[parsed.field];
    if (raw == null) return now; // missing → send now
    const at = new Date(String(raw));
    if (isNaN(at.getTime())) return now; // unparseable → send now
    return at.getTime() < now.getTime() ? now : at; // past → send now
}

/** Milliseconds from now until `at`, floored at 0. */
export function msUntil(at: Date, from: Date = new Date()): number {
    return Math.max(0, at.getTime() - from.getTime());
}
