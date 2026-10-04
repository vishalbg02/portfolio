import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A tiny stand-in for the browser: localStorage, events, and an AudioContext that counts what it is asked to play. */
function fakeBrowser(opts: { audio?: boolean; storage?: boolean } = {}) {
  const store = new Map<string, string>();
  const listeners = new Map<string, Set<(e: Event) => void>>();
  const events: Array<{ type: string; detail: unknown }> = [];
  const oscillators: Array<{ f: number; start: number }> = [];
  const contexts: object[] = [];
  class FakeAudio {
    state = "running";
    currentTime = 10;
    destination = {};
    constructor() {
      contexts.push(this);
    }
    resume() {
      return Promise.resolve();
    }
    createOscillator() {
      const o: Record<string, unknown> = {
        type: "",
        frequency: { value: 0 },
        connect: (x: unknown) => x,
        start: (t: number) => oscillators.push({ f: (o.frequency as { value: number }).value, start: t }),
        stop: () => {},
      };
      return o;
    }
    createGain() {
      return {
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: (x: unknown) => x,
      };
    }
  }
  const win: Record<string, unknown> = {
    ...(opts.audio === false ? {} : { AudioContext: FakeAudio }),
    addEventListener: (t: string, cb: (e: Event) => void) => {
      if (!listeners.has(t)) listeners.set(t, new Set());
      listeners.get(t)!.add(cb);
    },
    removeEventListener: (t: string, cb: (e: Event) => void) => void listeners.get(t)?.delete(cb),
    dispatchEvent: (e: { type: string; detail?: unknown }) => {
      events.push({ type: e.type, detail: e.detail });
      listeners.get(e.type)?.forEach((cb) => cb(e as Event));
      return true;
    },
  };
  if (opts.storage === false)
    Object.defineProperty(win, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
  else
    win.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  vi.stubGlobal("window", win);
  vi.stubGlobal(
    "CustomEvent",
    class {
      constructor(
        public type: string,
        init?: { detail?: unknown },
      ) {
        Object.assign(this, { detail: init?.detail });
      }
    },
  );
  return {
    store,
    events,
    oscillators,
    contexts,
    fire: (type: string) => (win.dispatchEvent as (e: unknown) => void)({ type }),
  };
}

const track = vi.fn();
beforeEach(() => {
  vi.resetModules();
  track.mockClear();
  vi.doMock("@/lib/analytics", () => ({ track }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("@/lib/analytics");
});

describe("achievements", () => {
  it("reads what is stored defensively: unknown ids, duplicates, junk and non-lists are ignored; order is the defined order", async () => {
    const { parse, ACHIEVEMENT_IDS } = await import("@/lib/achievements");
    expect(parse(null)).toEqual([]);
    expect(parse("")).toEqual([]);
    expect(parse("not json")).toEqual([]);
    expect(parse('{"a":1}')).toEqual([]);
    expect(parse('["grid","grid","nope",3,"terminal"]')).toEqual(["terminal", "grid"]);
    expect(ACHIEVEMENT_IDS).toHaveLength(8);
  });

  it("unlocks once: stores it, tells the page and counts it anonymously, and does nothing the second time", async () => {
    const b = fakeBrowser();
    const a = await import("@/lib/achievements");
    expect(a.unlock("city")).toBe(true);
    expect(a.unlock("city")).toBe(false);
    expect(a.readUnlocked()).toEqual(["city"]);
    expect(b.store.get(a.STORAGE_KEY)).toBe('["city"]');
    expect(b.events.filter((e) => e.type === a.ACH_EVENT)).toEqual([
      { type: a.ACH_EVENT, detail: { id: "city", count: 1 } },
    ]);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("secret_found", { name: "city" });
    a.unlock("terminal");
    expect(b.store.get(a.STORAGE_KEY)).toBe('["terminal","city"]'); // kept in the defined order
  });

  it("works with storage blocked (it still counts for the visit) and never throws outside a browser", async () => {
    fakeBrowser({ storage: false });
    const a = await import("@/lib/achievements");
    expect(() => a.unlock("grid")).not.toThrow();
    expect(a.readUnlocked()).toEqual([]);
    vi.unstubAllGlobals();
    expect(a.unlock("grid")).toBe(false);
  });

  it("every achievement has a label and a hint that tells you how to find it", async () => {
    const { ACHIEVEMENTS } = await import("@/lib/achievements");
    expect(new Set(ACHIEVEMENTS.map((x) => x.id)).size).toBe(ACHIEVEMENTS.length);
    for (const x of ACHIEVEMENTS) {
      expect(x.label.length).toBeGreaterThan(5);
      expect(x.hint.length).toBeGreaterThan(8);
    }
  });
});

describe("sound", () => {
  it("is off until chosen; nothing plays and no audio context is made before then", async () => {
    const b = fakeBrowser();
    const s = await import("@/lib/sound");
    expect(s.initSound()).toBe(false);
    s.play("click");
    s.play("chime");
    expect(b.contexts).toHaveLength(0);
    expect(b.oscillators).toHaveLength(0);
  });

  it("turning it on (a gesture) makes the context, plays a confirming click, remembers the choice and counts it once", async () => {
    const b = fakeBrowser();
    const s = await import("@/lib/sound");
    s.initSound();
    s.setSound(true);
    expect(b.contexts).toHaveLength(1);
    expect(b.store.get(s.SOUND_KEY)).toBe("on");
    expect(b.oscillators).toHaveLength(1); // the click
    expect(track).toHaveBeenCalledWith("sound_on");
    s.setSound(false);
    expect(b.store.get(s.SOUND_KEY)).toBe("off");
    s.play("chime");
    expect(b.oscillators).toHaveLength(1);
  });

  it("with sound already on from a past visit, the context waits for the first real gesture", async () => {
    const b = fakeBrowser();
    b.store.set("sound:v1", "on");
    const s = await import("@/lib/sound");
    expect(s.initSound()).toBe(true);
    expect(b.contexts).toHaveLength(0);
    s.play("click"); // no context yet: silence
    expect(b.oscillators).toHaveLength(0);
  });

  it("a chime is two notes; a held key does not machine-gun (cues have a minimum gap)", async () => {
    const b = fakeBrowser();
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const perf = vi.spyOn(performance, "now");
    const s = await import("@/lib/sound");
    s.initSound();
    s.setSound(true);
    b.oscillators.length = 0;
    perf.mockReturnValue(1000);
    s.play("chime");
    expect(b.oscillators.map((o) => Math.round(o.f))).toEqual([880, 1319]);
    perf.mockReturnValue(1100);
    s.play("chime"); // too soon
    expect(b.oscillators).toHaveLength(2);
    perf.mockReturnValue(1000 + s.MIN_GAP.tick);
    s.play("tick");
    s.play("tick"); // same instant: once
    expect(b.oscillators).toHaveLength(3);
    perf.mockRestore();
    vi.useRealTimers();
  });

  it("every cue is short, quiet and flat (no gain above 0.05)", async () => {
    const { CUES } = await import("@/lib/sound");
    for (const notes of Object.values(CUES))
      for (const n of notes) {
        expect(n.gain).toBeLessThanOrEqual(0.05);
        expect(n.at + n.len).toBeLessThan(0.6);
        expect(n.f).toBeGreaterThan(200);
      }
  });

  it("copes with no Web Audio and with blocked storage", async () => {
    fakeBrowser({ audio: false, storage: false });
    const s = await import("@/lib/sound");
    expect(() => {
      s.initSound();
      s.setSound(true);
      s.play("click");
    }).not.toThrow();
  });
});
