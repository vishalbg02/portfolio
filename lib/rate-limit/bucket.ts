/**
 * In-memory token bucket. This is the FALLBACK when Upstash isn't configured: on Vercel each
 * serverless instance has its own memory, so limits are per-instance, not global.
 * Time is injectable so it can be unit-tested without sleeping.
 */
export type BucketResult = { ok: boolean; remaining: number; retryAfterSec: number };

type Entry = { tokens: number; updated: number };

export class TokenBucketLimiter {
  private entries = new Map<string, Entry>();

  constructor(
    private readonly capacity: number,
    private readonly windowMs: number,
    private readonly maxKeys = 5000,
  ) {}

  take(key: string, now: number = Date.now()): BucketResult {
    const refillPerMs = this.capacity / this.windowMs;
    const entry = this.entries.get(key) ?? { tokens: this.capacity, updated: now };
    const tokens = Math.min(this.capacity, entry.tokens + (now - entry.updated) * refillPerMs);

    if (tokens < 1) {
      this.entries.set(key, { tokens, updated: now });
      return { ok: false, remaining: 0, retryAfterSec: Math.ceil((1 - tokens) / refillPerMs / 1000) };
    }
    this.entries.set(key, { tokens: tokens - 1, updated: now });
    if (this.entries.size > this.maxKeys) this.evict(now);
    return { ok: true, remaining: Math.floor(tokens - 1), retryAfterSec: 0 };
  }

  /** Drop entries that have fully refilled (they carry no information). */
  private evict(now: number) {
    for (const [key, e] of this.entries) {
      if (now - e.updated >= this.windowMs) this.entries.delete(key);
    }
  }
}
