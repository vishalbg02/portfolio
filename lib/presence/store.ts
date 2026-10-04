import "server-only";
import { Redis } from "@upstash/redis";
import { features } from "@/lib/env";
import { HERE_MS } from "./wall";

/**
 * Who is on the site: a sorted set of visitor ids scored by their last heartbeat. Two Redis commands per heartbeat
 * (set the score, drop the expired); the list itself is read at most every 15 seconds per instance.
 */
export interface HereStore {
  /** Records a heartbeat and trims the expired. */
  beat(id: string, now: number): Promise<void>;
  /** The ids whose last heartbeat is within the window (at most `limit`, newest first). */
  present(now: number, limit: number): Promise<string[]>;
}

const KEY = "vishalbg:here";

class UpstashHereStore implements HereStore {
  private r = Redis.fromEnv();
  async beat(id: string, now: number) {
    await this.r
      .pipeline()
      .zadd(KEY, { score: now, member: id })
      .zremrangebyscore(KEY, 0, now - HERE_MS)
      .exec();
  }
  async present(now: number, limit: number) {
    return this.r.zrange<string[]>(KEY, now - HERE_MS, "+inf", { byScore: true, offset: 0, count: limit });
  }
}

export class MemoryHereStore implements HereStore {
  private seen = new Map<string, number>();
  async beat(id: string, now: number) {
    this.seen.set(id, now);
    for (const [k, t] of this.seen) if (t < now - HERE_MS) this.seen.delete(k);
  }
  async present(now: number, limit: number) {
    return [...this.seen]
      .filter(([, t]) => t >= now - HERE_MS)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([k]) => k);
  }
}

let store: HereStore | null = null;
export const getHereStore = (): HereStore | null =>
  store ?? (features.upstash ? (store = new UpstashHereStore()) : null);
export const setHereStoreForTests = (s: HereStore | null) => {
  store = s;
};
