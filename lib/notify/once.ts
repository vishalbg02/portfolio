import "server-only";
import { Redis } from "@upstash/redis";
import { features } from "@/lib/env";

/**
 * Two small guards for the message route, in Redis when it is configured and in memory otherwise:
 *  - claimOnce: "has this request id been handled?" (a double click or a retry must not deliver twice)
 *  - underDailyCap: a global ceiling on messages per day, whoever sends them
 * Both fail OPEN on a Redis error (the per-client rate limit still applies), and store no message content.
 */
const memory = new Map<string, number>();
const sweep = (now: number) => {
  for (const [k, until] of memory) if (until <= now) memory.delete(k);
};
let redis: Redis | null = null;
const client = () => (redis ??= Redis.fromEnv());

export async function claimOnce(key: string, ttlSec: number): Promise<boolean> {
  const k = `vishalbg:once:${key}`;
  if (features.upstash) {
    try {
      return (await client().set(k, "1", { nx: true, ex: ttlSec })) === "OK";
    } catch (err) {
      console.error("[notify] claim failed, allowing:", (err as Error).message);
      return true;
    }
  }
  const now = Date.now();
  sweep(now);
  if (memory.has(k)) return false;
  memory.set(k, now + ttlSec * 1000);
  return true;
}

export async function releaseClaim(key: string): Promise<void> {
  const k = `vishalbg:once:${key}`;
  memory.delete(k);
  if (features.upstash)
    await client()
      .del(k)
      .catch(() => undefined);
}

const counters = new Map<string, number>();
export async function underDailyCap(scope: string, limit: number, now: Date = new Date()): Promise<boolean> {
  const k = `vishalbg:cap:${scope}:${now.toISOString().slice(0, 10)}`;
  if (features.upstash) {
    try {
      const r = client();
      const n = await r.incr(k);
      if (n === 1) await r.expire(k, 2 * 86_400);
      return n <= limit;
    } catch (err) {
      console.error("[notify] cap check failed, allowing:", (err as Error).message);
      return true;
    }
  }
  const n = (counters.get(k) ?? 0) + 1;
  counters.set(k, n);
  return n <= limit;
}

/** Tests: forget everything held in memory. */
export const resetOnce = () => {
  memory.clear();
  counters.clear();
};
