import "server-only";
import { Redis } from "@upstash/redis";
import { env, features } from "@/lib/env";
import { DEFAULT_DAILY_LIMIT } from "./limits";

/**
 * Global daily cap on requests that reach a paid model. Once reached, the assistant switches to its
 * offline (retrieval-only) answers until the next UTC day — so a spike can never run up a bill.
 * Counts only: no content, no identifiers.
 */
export interface BudgetStore {
  /** Atomically increments `key` (creating it with a TTL) and returns the new value. */
  incr(key: string, ttlSec: number): Promise<number>;
}

export class MemoryBudgetStore implements BudgetStore {
  private counts = new Map<string, number>();
  async incr(key: string) {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
}

class UpstashBudgetStore implements BudgetStore {
  private redis = Redis.fromEnv();
  async incr(key: string, ttlSec: number) {
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, ttlSec);
    return n;
  }
}

const memory = new MemoryBudgetStore();
let store: BudgetStore | null = null;
const defaultStore = () => (store ??= features.upstash ? new UpstashBudgetStore() : memory);

export const budgetKey = (now: Date) => `vishalbg:ai:${now.toISOString().slice(0, 10)}`;

export type BudgetResult = { ok: boolean; used: number; limit: number };

export async function consumeDaily(
  limit: number = env.AI_DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT,
  now: Date = new Date(),
  s: BudgetStore = defaultStore(),
): Promise<BudgetResult> {
  try {
    const used = await s.incr(budgetKey(now), 2 * 86_400);
    return { ok: used <= limit, used, limit };
  } catch (err) {
    // If the counter itself is down, fail CLOSED for cost safety: use the offline answers.
    console.error("[ai] budget store failed, using offline mode:", (err as Error).message);
    return { ok: false, used: limit, limit };
  }
}
