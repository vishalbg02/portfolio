import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { INTRO_KEY, INTRO_MS, INTRO_SCRIPT, REPLAY_KEY } from "@/lib/intro/script";

type Env = {
  path?: string;
  search?: string;
  hash?: string;
  reduce?: boolean;
  connection?: { saveData?: boolean; effectiveType?: string };
  storage?: Record<string, string> | "blocked";
};

/** Runs the exact shipped script against a fake window; returns what it did to <html> and its listeners. */
function run(env: Env = {}) {
  const attrs = new Map<string, string>();
  const listeners = new Map<string, () => void>();
  const timers: Array<() => void> = [];
  const store = env.storage === "blocked" ? null : { ...(env.storage ?? {}) };
  const sessionStorage = {
    getItem: (k: string) => {
      if (!store) throw new Error("blocked");
      return store[k] ?? null;
    },
    setItem: (k: string, v: string) => {
      if (!store) throw new Error("blocked");
      store[k] = v;
    },
    removeItem: (k: string) => {
      if (!store) throw new Error("blocked");
      delete store[k];
    },
  };
  const window: Record<string, unknown> = {
    matchMedia: (q: string) => ({ matches: q.includes("reduce") ? Boolean(env.reduce) : false }),
    addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
    setTimeout: (fn: () => void) => timers.push(fn),
  };
  const document = {
    documentElement: {
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      getAttribute: (k: string) => attrs.get(k) ?? null,
    },
  };
  runInNewContext(INTRO_SCRIPT, {
    window,
    document,
    sessionStorage,
    location: { pathname: env.path ?? "/", search: env.search ?? "", hash: env.hash ?? "" },
    navigator: { connection: env.connection },
    Date,
  });
  return { attrs, listeners, timers, store, window };
}

describe("intro head script: decide before the first paint", () => {
  it("plays on a first visit to the home page, and remembers it for the session", () => {
    const r = run();
    expect(r.attrs.get("data-intro")).toBe("play");
    expect(r.store![INTRO_KEY]).toBe("1");
    expect(r.attrs.has("data-intro-replay")).toBe(false);
  });

  it.each<[string, Env]>([
    ["a second visit in the same session", { storage: { [INTRO_KEY]: "1" } }],
    ["an inner page", { path: "/work/talnio" }],
    ["Recruiter Mode", { path: "/recruiter" }],
    ["a deep link to a section", { hash: "#contact" }],
    ["a proof link", { hash: "#proof=experience" }],
    ["?nointro", { search: "?nointro" }],
    ["?nointro=1 among other params", { search: "?a=1&nointro=1" }],
    ["the tour link", { search: "?tour=1" }],
    ["prefers-reduced-motion", { reduce: true }],
    ["Save-Data", { connection: { saveData: true } }],
    ["a 2G connection", { connection: { effectiveType: "2g" } }],
    ["a slow-2G connection", { connection: { effectiveType: "slow-2g" } }],
  ])("skips on %s", (_name, env) => {
    expect(run(env).attrs.get("data-intro")).toBe("skip");
  });

  it("plays on 3G and 4G, and without the Network Information API", () => {
    expect(run({ connection: { effectiveType: "3g" } }).attrs.get("data-intro")).toBe("play");
    expect(run({ connection: { effectiveType: "4g" } }).attrs.get("data-intro")).toBe("play");
    expect(run({ connection: undefined }).attrs.get("data-intro")).toBe("play");
  });

  it("still plays when storage is blocked (it simply cannot remember)", () => {
    expect(run({ storage: "blocked" }).attrs.get("data-intro")).toBe("play");
  });

  it("does not treat ?tournament or ?nointroduction as its flags", () => {
    expect(run({ search: "?tournament=x" }).attrs.get("data-intro")).toBe("play");
  });

  it("a personal company link (?c=) plays it, quietly (no GRID bubble: the banner greets them)", () => {
    const r = run({ search: "?c=abc.123" });
    expect(r.attrs.get("data-intro")).toBe("play");
    expect(r.attrs.has("data-intro-quiet")).toBe(true);
  });

  it("'Replay intro' plays it once more, marked as a replay, even after it was seen", () => {
    const r = run({ storage: { [INTRO_KEY]: "1", [REPLAY_KEY]: "1" } });
    expect(r.attrs.get("data-intro")).toBe("play");
    expect(r.attrs.has("data-intro-replay")).toBe(true);
    expect(r.store![REPLAY_KEY]).toBeUndefined(); // only once
    // but never against reduced motion
    expect(run({ reduce: true, storage: { [REPLAY_KEY]: "1" } }).attrs.get("data-intro")).toBe("skip");
  });

  it("any click, tap, key, wheel or scroll skips it; then it stops listening", () => {
    const r = run();
    expect([...r.listeners.keys()].sort()).toEqual([
      "keydown",
      "pointerdown",
      "scroll",
      "touchmove",
      "wheel",
    ]);
    r.listeners.get("keydown")!();
    expect(r.attrs.get("data-intro")).toBe("done");
    expect(typeof r.window.__introSkippedAt).toBe("number");
    expect(r.listeners.size).toBe(0);
  });

  it(`ends by itself after ${INTRO_MS} ms (the CSS removes the overlay at the same time, JS or not)`, () => {
    const r = run();
    r.timers.forEach((t) => t());
    expect(r.attrs.get("data-intro")).toBe("ended");
    expect(r.listeners.size).toBe(0);
  });

  it("adds no listeners and no timers when it skips", () => {
    const r = run({ path: "/now" });
    expect(r.listeners.size).toBe(0);
    expect(r.timers).toHaveLength(0);
  });

  it("stays small (it is in every page's HTML)", () => {
    expect(INTRO_SCRIPT.length).toBeLessThan(1400);
  });
});
