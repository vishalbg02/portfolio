import "server-only";
import { Redis } from "@upstash/redis";
import { features } from "@/lib/env";
import { DEFAULT_PRESENCE, LIVE, type Conv, type LiveMessage, type Presence } from "./types";

/**
 * Where threads live. Upstash Redis in production (every key expires after 30 days), an in-memory copy for tests.
 * Commands are kept few on purpose: Upstash's free plan allows 500,000 a month, and a visitor's browser polls.
 *
 *   c:{id}        the conversation (JSON)          c:{id}:m   the messages (a list)      c:{id}:v   its version (a counter)
 *   c:{id}:seen   when the visitor last polled      s:{short}  short code → id            tg:{message id} → conv id
 *   presence      Vishal's presence                 pending    a sorted set of waiting conversations (score = when)
 *   stat:{day}:{name}  daily counters               block:{ip hash}  blocked clients       emails:{id}:{day}  reply emails sent
 */
export interface LiveStore {
  createConv(c: Conv): Promise<void>;
  getConv(id: string): Promise<Conv | null>;
  updateConv(id: string, patch: Partial<Conv>): Promise<Conv | null>;
  idByShort(short: string): Promise<string | null>;
  /** Adds a message; returns it with its number, and bumps the thread's version. */
  append(id: string, m: Omit<LiveMessage, "n">): Promise<LiveMessage>;
  /** Messages after the first `after` (0 = all). */
  messages(id: string, after: number): Promise<LiveMessage[]>;
  version(id: string): Promise<number>;
  touchSeen(id: string, now: number): Promise<void>;
  lastSeen(id: string): Promise<number | null>;
  mapTelegram(messageId: number, id: string): Promise<void>;
  convForTelegram(messageId: number): Promise<string | null>;
  getPresence(): Promise<Presence>;
  setPresence(p: Presence): Promise<void>;
  addPending(id: string, at: number): Promise<void>;
  removePending(id: string): Promise<void>;
  listPending(limit: number): Promise<Array<{ id: string; at: number }>>;
  incrStat(day: string, name: string): Promise<void>;
  getStats(day: string, names: string[]): Promise<Record<string, number>>;
  blockIp(hash: string): Promise<void>;
  isIpBlocked(hash: string): Promise<boolean>;
  countEmail(id: string, day: string): Promise<number>;
}

const P = "vishalbg:live:";

export class UpstashLiveStore implements LiveStore {
  private r = Redis.fromEnv();
  private ttl = LIVE.ttlSec;

  async createConv(c: Conv) {
    await Promise.all([
      this.r.set(`${P}c:${c.id}`, c, { ex: this.ttl }),
      this.r.set(`${P}s:${c.short}`, c.id, { ex: this.ttl }),
    ]);
  }
  getConv(id: string) {
    return this.r.get<Conv>(`${P}c:${id}`);
  }
  async updateConv(id: string, patch: Partial<Conv>) {
    const cur = await this.getConv(id);
    if (!cur) return null;
    const next = { ...cur, ...patch };
    await this.r.set(`${P}c:${id}`, next, { ex: this.ttl });
    return next;
  }
  idByShort(short: string) {
    return this.r.get<string>(`${P}s:${short}`);
  }
  async append(id: string, m: Omit<LiveMessage, "n">) {
    const n = await this.r.rpush(`${P}c:${id}:m`, m);
    await Promise.all([
      this.r.incr(`${P}c:${id}:v`),
      this.r.expire(`${P}c:${id}:m`, this.ttl),
      this.r.expire(`${P}c:${id}:v`, this.ttl),
    ]);
    return { ...m, n };
  }
  async messages(id: string, after: number) {
    const rows = await this.r.lrange<Omit<LiveMessage, "n">>(`${P}c:${id}:m`, after, -1);
    return rows.map((m, i) => ({ ...m, n: after + i + 1 }));
  }
  async version(id: string) {
    return (await this.r.get<number>(`${P}c:${id}:v`)) ?? 0;
  }
  async touchSeen(id: string, now: number) {
    await this.r.set(`${P}c:${id}:seen`, now, { ex: 600 });
  }
  lastSeen(id: string) {
    return this.r.get<number>(`${P}c:${id}:seen`);
  }
  async mapTelegram(messageId: number, id: string) {
    await this.r.set(`${P}tg:${messageId}`, id, { ex: this.ttl });
  }
  convForTelegram(messageId: number) {
    return this.r.get<string>(`${P}tg:${messageId}`);
  }
  async getPresence() {
    return (await this.r.get<Presence>(`${P}presence`)) ?? DEFAULT_PRESENCE;
  }
  async setPresence(p: Presence) {
    await this.r.set(`${P}presence`, p);
  }
  async addPending(id: string, at: number) {
    await this.r.zadd(`${P}pending`, { score: at, member: id });
  }
  async removePending(id: string) {
    await this.r.zrem(`${P}pending`, id);
  }
  async listPending(limit: number) {
    const rows = await this.r.zrange<string[]>(`${P}pending`, 0, limit - 1, { withScores: true });
    const out: Array<{ id: string; at: number }> = [];
    for (let i = 0; i < rows.length; i += 2) out.push({ id: String(rows[i]), at: Number(rows[i + 1]) });
    return out;
  }
  async incrStat(day: string, name: string) {
    const k = `${P}stat:${day}:${name}`;
    if ((await this.r.incr(k)) === 1) await this.r.expire(k, 8 * 86_400);
  }
  async getStats(day: string, names: string[]) {
    if (names.length === 0) return {};
    const vals = await this.r.mget<Array<number | null>>(...names.map((n) => `${P}stat:${day}:${n}`));
    return Object.fromEntries(names.map((n, i) => [n, Number(vals[i] ?? 0)]));
  }
  async blockIp(hash: string) {
    await this.r.set(`${P}block:${hash}`, 1, { ex: this.ttl });
  }
  async isIpBlocked(hash: string) {
    return (await this.r.exists(`${P}block:${hash}`)) === 1;
  }
  async countEmail(id: string, day: string) {
    const k = `${P}emails:${id}:${day}`;
    const n = await this.r.incr(k);
    if (n === 1) await this.r.expire(k, 2 * 86_400);
    return n;
  }
}

/** In-memory twin of the store, for tests (and nothing else: serverless instances do not share memory). */
export class MemoryLiveStore implements LiveStore {
  convs = new Map<string, Conv>();
  shorts = new Map<string, string>();
  msgs = new Map<string, Array<Omit<LiveMessage, "n">>>();
  versions = new Map<string, number>();
  seen = new Map<string, number>();
  tg = new Map<number, string>();
  presence: Presence = DEFAULT_PRESENCE;
  pending = new Map<string, number>();
  stats = new Map<string, number>();
  blocked = new Set<string>();
  emails = new Map<string, number>();

  async createConv(c: Conv) {
    this.convs.set(c.id, { ...c });
    this.shorts.set(c.short, c.id);
  }
  async getConv(id: string) {
    const c = this.convs.get(id);
    return c ? { ...c } : null;
  }
  async updateConv(id: string, patch: Partial<Conv>) {
    const c = this.convs.get(id);
    if (!c) return null;
    const next = { ...c, ...patch };
    this.convs.set(id, next);
    return { ...next };
  }
  async idByShort(short: string) {
    return this.shorts.get(short) ?? null;
  }
  async append(id: string, m: Omit<LiveMessage, "n">) {
    const list = this.msgs.get(id) ?? [];
    list.push(m);
    this.msgs.set(id, list);
    this.versions.set(id, (this.versions.get(id) ?? 0) + 1);
    return { ...m, n: list.length };
  }
  async messages(id: string, after: number) {
    return (this.msgs.get(id) ?? []).slice(after).map((m, i) => ({ ...m, n: after + i + 1 }));
  }
  async version(id: string) {
    return this.versions.get(id) ?? 0;
  }
  async touchSeen(id: string, now: number) {
    this.seen.set(id, now);
  }
  async lastSeen(id: string) {
    return this.seen.get(id) ?? null;
  }
  async mapTelegram(messageId: number, id: string) {
    this.tg.set(messageId, id);
  }
  async convForTelegram(messageId: number) {
    return this.tg.get(messageId) ?? null;
  }
  async getPresence() {
    return this.presence;
  }
  async setPresence(p: Presence) {
    this.presence = p;
  }
  async addPending(id: string, at: number) {
    this.pending.set(id, at);
  }
  async removePending(id: string) {
    this.pending.delete(id);
  }
  async listPending(limit: number) {
    return [...this.pending.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, limit)
      .map(([id, at]) => ({ id, at }));
  }
  async incrStat(day: string, name: string) {
    const k = `${day}:${name}`;
    this.stats.set(k, (this.stats.get(k) ?? 0) + 1);
  }
  async getStats(day: string, names: string[]) {
    return Object.fromEntries(names.map((n) => [n, this.stats.get(`${day}:${n}`) ?? 0]));
  }
  async blockIp(hash: string) {
    this.blocked.add(hash);
  }
  async isIpBlocked(hash: string) {
    return this.blocked.has(hash);
  }
  async countEmail(id: string, day: string) {
    const k = `${id}:${day}`;
    const n = (this.emails.get(k) ?? 0) + 1;
    this.emails.set(k, n);
    return n;
  }
}

let store: LiveStore | null = null;
export const getLiveStore = (): LiveStore =>
  (store ??= features.upstash ? new UpstashLiveStore() : new MemoryLiveStore());
/** Tests inject a store here. */
export const setLiveStoreForTests = (s: LiveStore | null) => {
  store = s;
};
