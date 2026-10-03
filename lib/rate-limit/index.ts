import "server-only";
import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { features } from "@/lib/env";
import { TokenBucketLimiter, type BucketResult } from "./bucket";

export type LimitOptions = {
  /** Namespaces the limit, e.g. "contact" or "chat". */
  scope: string;
  limit: number;
  windowSec: number;
};

const buckets = new Map<string, TokenBucketLimiter>();
const upstash = new Map<string, Ratelimit>();

function upstashLimiter({ scope, limit, windowSec }: LimitOptions) {
  const id = `${scope}:${limit}:${windowSec}`;
  let rl = upstash.get(id);
  if (!rl) {
    rl = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: `vishalbg:${scope}`,
      analytics: false,
    });
    upstash.set(id, rl);
  }
  return rl;
}

/**
 * Anonymous client key: a salted hash of the IP, never the IP itself. Nothing identifying is
 * stored in memory or in Upstash.
 */
export function clientKey(headers: Headers): string {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`vishalbg-salt:${ip}`).digest("hex").slice(0, 32);
}

/** Shared limiter: Upstash when configured, otherwise a per-instance token bucket. Fails open on Upstash errors. */
export async function rateLimit(opts: LimitOptions, key: string): Promise<BucketResult> {
  if (features.upstash) {
    try {
      const r = await upstashLimiter(opts).limit(key);
      return {
        ok: r.success,
        remaining: r.remaining,
        retryAfterSec: Math.max(0, Math.ceil((r.reset - Date.now()) / 1000)),
      };
    } catch (err) {
      console.error("[rate-limit] upstash failed, using in-memory fallback:", (err as Error).message);
    }
  }
  const id = `${opts.scope}:${opts.limit}:${opts.windowSec}`;
  let bucket = buckets.get(id);
  if (!bucket) {
    bucket = new TokenBucketLimiter(opts.limit, opts.windowSec * 1000);
    buckets.set(id, bucket);
  }
  return bucket.take(key);
}
