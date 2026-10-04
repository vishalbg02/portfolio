import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_AWAY_MS,
  applyCommand,
  effectivePresence,
  inHours,
  istClock,
  istDate,
  istHour,
  parseHours,
  presenceView,
  touch,
} from "@/lib/live/presence";
import { createPoller, nextDelay, POLL } from "@/lib/live/transport";
import { parseThreadParam } from "@/lib/live/session";
import { validateLive } from "@/lib/live/rules";
import { DEFAULT_PRESENCE, LIVE, type Presence } from "@/lib/live/types";
import { loadLive } from "./helpers/live";

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/rate-limit");
  vi.doUnmock("@/lib/notify/once");
  vi.doUnmock("@/lib/email/send");
});

/** 2026-10-04 at the given Bengaluru hour (IST = UTC+5:30). */
const ist = (h: number, m = 0) => Date.UTC(2026, 9, 4, h - 5, m - 30);
const MIN = 60_000;

describe("Bengaluru time", () => {
  it("reads the hour, the clock and the date in IST, across midnight too", () => {
    expect(istHour(ist(23, 40))).toBe(23);
    expect(istClock(ist(23, 40))).toBe("11:40 pm");
    expect(istClock(ist(0, 5))).toBe("12:05 am");
    expect(istClock(ist(12, 0))).toBe("12:00 pm");
    expect(istDate(ist(23, 59))).toBe("2026-10-04");
    expect(istDate(ist(24, 1))).toBe("2026-10-05"); // 00:01 IST is already the next IST day
  });

  it("parses office hours, including overnight ones, and refuses nonsense", () => {
    expect(parseHours("10-22")).toEqual({ from: 10, to: 22 });
    expect(parseHours("10:00-22:00")).toEqual({ from: 10, to: 22 });
    expect(parseHours("22-6")).toEqual({ from: 22, to: 6 });
    expect(parseHours("9 to 17")).toEqual({ from: 9, to: 17 });
    for (const bad of ["", "ten-twenty", "10", "25-3", "10-10", "-5-9"])
      expect(parseHours(bad), bad).toBeNull();
    expect(inHours({ from: 10, to: 22 }, ist(10))).toBe(true);
    expect(inHours({ from: 10, to: 22 }, ist(21, 59))).toBe(true);
    expect(inHours({ from: 10, to: 22 }, ist(22))).toBe(false);
    expect(inHours({ from: 22, to: 6 }, ist(23))).toBe(true);
    expect(inHours({ from: 22, to: 6 }, ist(3))).toBe(true);
    expect(inHours({ from: 22, to: 6 }, ist(12))).toBe(false);
  });
});

describe("presence state machine", () => {
  const now = ist(15);
  const base = (p: Partial<Presence>): Presence => ({ ...DEFAULT_PRESENCE, ...p });

  it.each<[string, Partial<Presence>, "online" | "away"]>([
    ["nothing set and never active", {}, "away"],
    ["nothing set, active 5 min ago", { lastActiveAt: now - 5 * MIN }, "online"],
    ["nothing set, active 21 min ago (auto-away)", { lastActiveAt: now - 21 * MIN }, "away"],
    ["exactly 20 min ago is already away", { lastActiveAt: now - AUTO_AWAY_MS }, "away"],
    ["/online and active 19 min ago", { mode: "online", lastActiveAt: now - 19 * MIN }, "online"],
    ["/online but silent for an hour (auto-away)", { mode: "online", lastActiveAt: now - 60 * MIN }, "away"],
    ["/away even though just active", { mode: "away", lastActiveAt: now }, "away"],
    ["hours 10-22 at 15:00, never active", { hours: { from: 10, to: 22 } }, "online"],
    ["hours 10-22 at 15:00 but /away", { mode: "away", hours: { from: 10, to: 22 } }, "away"],
    [
      "hours 16-22 at 15:00, active a minute ago",
      { hours: { from: 16, to: 22 }, lastActiveAt: now - MIN },
      "away",
    ],
  ])("%s → %s", (_n, p, expected) => {
    expect(effectivePresence(base(p), now)).toBe(expected);
  });

  it("applies his commands, and every command counts as activity", () => {
    let p = DEFAULT_PRESENCE;
    ({ presence: p } = applyCommand(p, "online", "", now));
    expect(p).toMatchObject({ mode: "online", lastActiveAt: now });
    ({ presence: p } = applyCommand(p, "away", "", now + MIN));
    expect(p).toMatchObject({ mode: "away", lastActiveAt: now + MIN });
    const hours = applyCommand(p, "hours", "10-22", now + 2 * MIN);
    expect(hours).toMatchObject({ ok: true, presence: { mode: "auto", hours: { from: 10, to: 22 } } });
    const cleared = applyCommand(hours.presence, "hours", "off", now + 3 * MIN);
    expect(cleared.presence).toMatchObject({ mode: "auto", hours: null });
    const bad = applyCommand(hours.presence, "hours", "whenever", now + 4 * MIN);
    expect(bad.ok).toBe(false);
    expect(bad.presence.hours).toEqual({ from: 10, to: 22 }); // unchanged
    expect(bad.presence.lastActiveAt).toBe(now + 4 * MIN);
  });

  it("any message from him refreshes activity but never undoes an explicit /away", () => {
    const away = touch(base({ mode: "away" }), now);
    expect(effectivePresence(away, now)).toBe("away");
    expect(effectivePresence(touch(DEFAULT_PRESENCE, now), now + MIN)).toBe("online");
  });

  it("builds the chip text: online says replies in minutes, away says GRID takes a message and shows Bengaluru time", () => {
    expect(presenceView(base({ mode: "online", lastActiveAt: now }), now)).toMatchObject({
      state: "online",
      label: "Online — replies in minutes",
      configured: true,
    });
    const away = presenceView(base({}), ist(23, 40));
    expect(away).toMatchObject({ state: "away", label: "Away — GRID will take a message", time: "11:40 pm" });
    expect(presenceView(null, now, false).configured).toBe(false);
  });
});

describe("signed thread links", () => {
  it("accepts only the signature made for that id, with that secret", async () => {
    await loadLive();
    const { sign, verify, threadLink, unsubscribeLink } = await import("@/lib/live/token");
    const id = "11111111-2222-4333-8444-555555555555";
    const sig = sign(id);
    expect(sig).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(verify(id, sig)).toBe(true);
    expect(verify(id, sig.slice(0, -1) + (sig.endsWith("a") ? "b" : "a"))).toBe(false);
    expect(verify("11111111-2222-4333-8444-555555555556", sig)).toBe(false);
    expect(verify(id, "")).toBe(false);
    expect(sign(id, "another-secret")).not.toBe(sig);
    expect(verify(id, sig, "")).toBe(false); // no secret configured: nothing verifies
    expect(threadLink(id)).toContain(`/?chat=${id}.${sig}`);
    expect(unsubscribeLink(id)).toContain(`c=${id}&k=${sig}`);
  });

  it("reads a ?chat= value only if it is exactly an id and a signature", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    expect(parseThreadParam(`${id}.abcdefghijklmnopqrstuvwx`)).toEqual({
      c: id,
      k: "abcdefghijklmnopqrstuvwx",
    });
    for (const bad of [
      null,
      "",
      "nope",
      `${id}`,
      `${id}.short`,
      `${id}.<script>alert(1)</script>`,
      `../${id}.abcdefghijklmnopqrstuvwx`,
    ])
      expect(parseThreadParam(bad as string | null), String(bad)).toBeNull();
  });
});

describe("adaptive polling", () => {
  it("asks often while there is activity, slower as it goes quiet, slowest when hidden, and stops after half an hour", () => {
    expect(nextDelay(0, false)).toBe(POLL.activeMs);
    expect(nextDelay(119_000, false)).toBe(POLL.activeMs);
    expect(nextDelay(3 * MIN, false)).toBe(POLL.quietMs);
    expect(nextDelay(11 * MIN, false)).toBe(POLL.idleMs);
    expect(nextDelay(5 * MIN, true)).toBe(POLL.hiddenMs);
    expect(nextDelay(30 * MIN, false)).toBeNull();
  });

  function harness(pollImpl: () => Promise<boolean>, hidden = false) {
    let t = 0;
    const timers: Array<{ id: number; at: number; fn: () => void }> = [];
    let id = 0;
    const poller = createPoller({
      poll: pollImpl,
      now: () => t,
      hidden: () => hidden,
      setTimer: (fn, ms) => {
        timers.push({ id: ++id, at: t + ms, fn });
        return id;
      },
      clearTimer: (i) => {
        const k = timers.findIndex((x) => x.id === i);
        if (k >= 0) timers.splice(k, 1);
      },
    });
    const advance = async (ms: number) => {
      const end = t + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        t = next.at;
        next.fn();
        await Promise.resolve();
        await Promise.resolve();
      }
      t = end;
    };
    return { poller, advance, timers, setNow: (n: number) => (t = n) };
  }

  it("polls every few seconds, keeps going through a failure, and stops when idle", async () => {
    let calls = 0;
    const h = harness(async () => {
      calls += 1;
      if (calls === 2) throw new Error("network");
      return false;
    });
    h.poller.start();
    await h.advance(10_000);
    expect(calls).toBe(3); // 3 s, 6 s, 9 s: the failed ask did not stop it
    await h.advance(40 * MIN);
    expect(h.poller.running).toBe(false); // nothing for 30 minutes: it gave up
  });

  it("goes back to asking often when something arrives or the visitor sends", async () => {
    let calls = 0;
    const h = harness(async () => {
      calls += 1;
      return calls === 1;
    });
    h.poller.start();
    await h.advance(3_000); // first ask: news
    await h.advance(2 * MIN + 10_000);
    const before = calls;
    expect(before).toBeGreaterThan(30); // asked every 3 s while it was fresh
    h.poller.activity();
    await h.advance(6_500);
    expect(calls).toBeGreaterThan(before);
  });
});

describe("the live chat's field rules", () => {
  const ok = { name: "Asha Rao", email: "", org: "", message: "Hello Vishal, can we talk?" };

  it("needs a name only for a new conversation, and an email only when he is away", () => {
    expect(validateLive(ok, { needName: true, needEmail: false }).ok).toBe(true);
    expect(validateLive({ ...ok, name: "" }, { needName: true, needEmail: false })).toMatchObject({
      ok: false,
      errors: { name: expect.any(String) },
    });
    expect(validateLive({ ...ok, name: "" }, { needName: false, needEmail: false }).ok).toBe(true);
    expect(validateLive(ok, { needName: true, needEmail: true })).toMatchObject({
      ok: false,
      errors: { email: expect.any(String) },
    });
    expect(validateLive({ ...ok, email: "asha@example.com" }, { needName: true, needEmail: true }).ok).toBe(
      true,
    );
    expect(validateLive({ ...ok, email: "nope" }, { needName: true, needEmail: false })).toMatchObject({
      ok: false,
    });
  });

  it("limits the message and the number of links, and agrees with the server schema", async () => {
    const { LiveMessageSchema } = await import("@/lib/live/schema");
    const cases = [
      ok,
      { ...ok, message: "" },
      { ...ok, message: "m".repeat(LIVE.message.max) },
      { ...ok, message: "m".repeat(LIVE.message.max + 1) },
      { ...ok, message: "see a.io b.io c.io" },
      { ...ok, name: "N".repeat(81) },
      { ...ok, org: "o".repeat(121) },
      { ...ok, email: "asha@example.com" },
      { ...ok, email: "bad@" },
    ];
    for (const c of cases) {
      const browser = validateLive(c, { needName: true, needEmail: false }).ok;
      const server = LiveMessageSchema.safeParse({ ...c, email: c.email || undefined }).success;
      expect(server, JSON.stringify(c).slice(0, 70)).toBe(browser);
    }
  });
});
