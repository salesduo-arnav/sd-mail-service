import IORedis, { Redis } from 'ioredis';
import env from './env';
import Logger from '../utils/logger';

/**
 * Redis. We standardize on ioredis (BullMQ requires it).
 *
 * - `redis` (below) is a shared instance for app-level ops: health pings,
 *   scheduler locks, short caches.
 * - BullMQ queues/workers are given plain connection *options* via
 *   `bullConnectionOpts()` so BullMQ manages its own connections (its
 *   recommended pattern, and it avoids the ioredis dual-package type clash).
 */
export interface BullConnOpts {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
    maxRetriesPerRequest: null;
}

export function bullConnectionOpts(): BullConnOpts {
    const u = new URL(env.REDIS_URL);
    return {
        host: u.hostname,
        port: Number(u.port) || 6379,
        username: u.username || undefined,
        password: env.REDIS_PASSWORD || u.password || undefined,
        db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) || 0 : 0,
        maxRetriesPerRequest: null,
    };
}

function build(): Redis {
    const client = new IORedis(env.REDIS_URL, {
        password: env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
    });
    client.on('error', (err) => Logger.error('Redis error', { message: err.message }));
    client.on('connect', () => Logger.info('Redis connected'));
    return client;
}

const redis = build();

/** Acquire a short-lived lock (SET NX PX). Returns true if acquired. */
export async function acquireLock(key: string, ttlMs: number): Promise<boolean> {
    return (await redis.set(key, '1', 'PX', ttlMs, 'NX')) === 'OK';
}

export async function releaseLock(key: string): Promise<void> {
    await redis.del(key).catch(() => undefined);
}

/**
 * Run `fn` while holding a per-key lock, briefly retrying to acquire. Used to
 * serialize same-subscriber event processing so concurrent workers can't create
 * duplicate runs or race the subscriber upsert. Throws if the lock can't be
 * acquired in time so the BullMQ job retries (and thus still runs, just later).
 */
export async function withLock<T>(key: string, fn: () => Promise<T>, ttlMs = 30_000): Promise<T> {
    for (let i = 0; i < 25; i++) {
        if (await acquireLock(key, ttlMs)) {
            try {
                return await fn();
            } finally {
                await releaseLock(key);
            }
        }
        await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`could not acquire lock ${key}`);
}

export const closeRedis = async () => {
    await redis.quit();
};

export default redis;
