import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PRESENCE, LIVE, type Conv } from "@/lib/live/types";

/** A fake Upstash client that records every command, to check the store's key use, expiries and command budget. */
const log: Array<[string, ...unknown[]]> = [];
const kv = new Map<string, unknown>();
const ttl = new Map<string, number>();
const lists = new Map<string, unknown[]>();
const zsets = new Map<string, Map<string, number>>();
const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

class FakeRedis {
  static fromEnv() {
    return new FakeRedis();
  }
  async set(k: string, v: unknown, o?: { ex?: number }) {
    log.push(["set", k, o]);
    kv.set(k, clone(v));
    if (o?.ex) ttl.set(k, o.ex);
    return "OK";
  }
  async get(k: string) {
    log.push(["get", k]);
    return clone(kv.get(k) ?? null);
  }
  async del(k: string) {
    log.push(["del", k]);
    kv.delete(k);
  }
  async exists(k: string) {
    log.push(["exists", k]);
    return kv.has(k) ? 1 : 0;
  }
  async incr(k: string) {
    log.push(["incr", k]);
    const n = Number(kv.get(k) ?? 0) + 1;
    kv.set(k, n);
    return n;
  }
  async expire(k: string, s: number) {
    log.push(["expire", k, s]);
    ttl.set(k, s);
  }
  async rpush(k: string, v: unknown) {
    log.push(["rpush", k]);
    const l = lists.get(k) ?? [];
    l.push(clone(v));
    lists.set(k, l);
    return l.length;
  }
  async lrange(k: string, from: number, to: number) {
    log.push(["lrange", k, from, to]);
    return clone((lists.get(k) ?? []).slice(from, to === -1 ? undefined : to + 1));
  }
  async zadd(k: string, e: { score: number; member: string }) {
    log.push(["zadd", k]);
    const z = zsets.get(k) ?? new Map();
    z.set(e.member, e.score);
    zsets.set(k, z);
  }
  async zrem(k: string, m: string) {
    log.push(["zrem", k]);
    zsets.get(k)?.delete(m);
  }
  async zrange(k: string, from: number, to: number, o?: { withScores?: boolean }) {
    log.push(["zrange", k]);
    const rows = [...(zsets.get(k) ?? new Map<string, number>()).entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(from, to + 1);
    return o?.withScores ? rows.flatMap(([m, s]) => [m, s]) : rows.map(([m]) => m);
  }
  async mget(...ks: string[]) {
    log.push(["mget", ...ks]);
    return ks.map((k) => kv.get(k) ?? null);
  }
}
vi.mock("@upstash/redis", () => ({ Redis: FakeRedis }));

const conv = (over: Partial<Conv> = {}): Conv => ({
  id: "11111111-2222-4333-8444-555555555555",
  short: "a1b2c3",
  name: "Asha",
  email: null,
  org: null,
  page: "/",
  ipHash: "h",
  createdAt: 1,
  blocked: false,
  optOut: false,
  lastVisitorAt: 1,
  lastOwnerAt: null,
  via: "live",
  ...over,
});
const P = "vishalbg:live:";
const THIRTY_DAYS = LIVE.ttlSec;

beforeEach(() => {
  log.length = 0;
  kv.clear();
  ttl.clear();
  lists.clear();
  zsets.clear();
});
const store = async () => new (await import("@/lib/live/store")).UpstashLiveStore();
const cmds = () => log.map((c) => c[0]);

describe("UpstashLiveStore", () => {
  it("every key it creates expires after 30 days (except Vishal's presence setting)", async () => {
    const s = await store();
    const c = conv({ email: "a@b.co" });
    await s.createConv(c);
    await s.append(c.id, { from: "visitor", text: "hi", t: 1 });
    await s.mapTelegram(77, c.id);
    await s.touchSeen(c.id, 5);
    await s.blockIp("h");
    await s.incrStat("2026-10-04", "msg_in");
    await s.countEmail(c.id, "2026-10-04");
    await s.setPresence({ mode: "online", hours: null, lastActiveAt: 1 });
    for (const k of [
      `${P}c:${c.id}`,
      `${P}s:a1b2c3`,
      `${P}c:${c.id}:m`,
      `${P}c:${c.id}:v`,
      `${P}tg:77`,
      `${P}block:h`,
    ])
      expect(ttl.get(k), k).toBe(THIRTY_DAYS);
    expect(ttl.get(`${P}c:${c.id}:seen`)).toBe(600);
    expect(ttl.get(`${P}stat:2026-10-04:msg_in`)).toBe(8 * 86_400);
    expect(ttl.get(`${P}emails:${c.id}:2026-10-04`)).toBe(2 * 86_400);
    expect(ttl.has(`${P}presence`)).toBe(false); // a setting, not a thread
  });

  it("numbers messages by their place in the list, and returns only what is after a given number", async () => {
    const s = await store();
    const c = conv();
    await s.createConv(c);
    const m1 = await s.append(c.id, { from: "visitor", text: "one", t: 1 });
    const m2 = await s.append(c.id, { from: "vishal", text: "two", t: 2 });
    const m3 = await s.append(c.id, { from: "visitor", text: "three", t: 3 });
    expect([m1.n, m2.n, m3.n]).toEqual([1, 2, 3]);
    expect(await s.messages(c.id, 0)).toMatchObject([{ n: 1 }, { n: 2 }, { n: 3 }]);
    expect(await s.messages(c.id, 1)).toMatchObject([
      { n: 2, text: "two" },
      { n: 3, text: "three" },
    ]);
    expect(await s.messages(c.id, 3)).toEqual([]);
    expect(await s.version(c.id)).toBe(3);
  });

  it("an ordinary 'anything new?' poll costs two Redis commands, and only a change adds the list read", async () => {
    const s = await store();
    const c = conv();
    await s.createConv(c);
    await s.append(c.id, { from: "visitor", text: "hi", t: 1 });
    log.length = 0;
    await Promise.all([s.version(c.id), s.touchSeen(c.id, 9)]);
    expect(cmds().sort()).toEqual(["get", "set"]); // what /api/live/poll does when nothing changed
    log.length = 0;
    await s.messages(c.id, 1);
    expect(cmds()).toEqual(["lrange"]);
  });

  it("an hour of polling stays tiny: a 10-minute chat at 3 seconds is about 400 commands, far under 500,000 a month", async () => {
    const polls = (10 * 60) / 3;
    expect(polls * 2).toBeLessThan(500);
    expect((500_000 / (polls * 2)) | 0).toBeGreaterThan(1000); // over a thousand such chats a month on the free plan
  });

  it("keeps the conversation, its short code and its edits", async () => {
    const s = await store();
    const c = conv();
    await s.createConv(c);
    expect(await s.idByShort("a1b2c3")).toBe(c.id);
    expect(await s.idByShort("nope00")).toBeNull();
    expect(await s.updateConv(c.id, { email: "a@b.co", optOut: true })).toMatchObject({
      email: "a@b.co",
      optOut: true,
      name: "Asha",
    });
    expect(await s.updateConv("22222222-2222-4333-8444-555555555555", { name: "x" })).toBeNull();
    expect(ttl.get(`${P}c:${c.id}`)).toBe(THIRTY_DAYS); // an edit does not shorten or lose the expiry
  });

  it("presence defaults to 'nothing set', and round-trips", async () => {
    const s = await store();
    expect(await s.getPresence()).toEqual(DEFAULT_PRESENCE);
    await s.setPresence({ mode: "online", hours: { from: 10, to: 22 }, lastActiveAt: 5 });
    expect(await s.getPresence()).toEqual({ mode: "online", hours: { from: 10, to: 22 }, lastActiveAt: 5 });
  });

  it("lists who is waiting oldest first, and forgets them when answered", async () => {
    const s = await store();
    await s.addPending("a", 300);
    await s.addPending("b", 100);
    await s.addPending("c", 200);
    expect(await s.listPending(2)).toEqual([
      { id: "b", at: 100 },
      { id: "c", at: 200 },
    ]);
    await s.removePending("b");
    expect((await s.listPending(5)).map((p) => p.id)).toEqual(["c", "a"]);
  });

  it("counts per day, reads several counters in one command, and treats a missing one as zero", async () => {
    const s = await store();
    await s.incrStat("2026-10-04", "msg_in");
    await s.incrStat("2026-10-04", "msg_in");
    await s.incrStat("2026-10-04", "conv_started");
    log.length = 0;
    expect(await s.getStats("2026-10-04", ["msg_in", "conv_started", "msg_out"])).toEqual({
      msg_in: 2,
      conv_started: 1,
      msg_out: 0,
    });
    expect(cmds()).toEqual(["mget"]);
    expect(await s.getStats("2026-10-05", ["msg_in"])).toEqual({ msg_in: 0 });
  });

  it("blocks a client, and counts reply emails per conversation per day", async () => {
    const s = await store();
    expect(await s.isIpBlocked("h")).toBe(false);
    await s.blockIp("h");
    expect(await s.isIpBlocked("h")).toBe(true);
    expect(await s.countEmail("c", "2026-10-04")).toBe(1);
    expect(await s.countEmail("c", "2026-10-04")).toBe(2);
    expect(await s.countEmail("c", "2026-10-05")).toBe(1);
  });
});
