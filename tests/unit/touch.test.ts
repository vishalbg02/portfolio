import { afterEach, describe, expect, it, vi } from "vitest";
import { BOOT_MS, shouldBoot } from "@/lib/boot";
import { haptic } from "@/lib/haptics";
import { createShakeDetector } from "@/lib/shake";

describe("shake detector", () => {
  const jolt = (d: ReturnType<typeof createShakeDetector>, t: number, mag = 30) => d.push(mag, 0, 0, t);
  it("fires after several hard jolts close together", () => {
    const d = createShakeDetector();
    expect([0, 150, 300, 450].map((t) => jolt(d, t))).toEqual([false, false, false, true]);
  });
  it("ignores weak movement (walking, a bumpy bus)", () => {
    const d = createShakeDetector();
    for (let t = 0; t < 4000; t += 120) expect(jolt(d, t, 9)).toBe(false);
  });
  it("one long jolt is not several: samples inside the same 90 ms jolt count once", () => {
    const d = createShakeDetector();
    expect([0, 20, 40, 60, 80].map((t) => jolt(d, t))).toEqual([false, false, false, false, false]);
  });
  it("jolts spread too far apart don't add up", () => {
    const d = createShakeDetector();
    expect([0, 700, 1400, 2100].map((t) => jolt(d, t))).toEqual([false, false, false, false]);
  });
  it("won't fire again during the cooldown, then can once it has passed", () => {
    const d = createShakeDetector();
    [0, 150, 300, 450].forEach((t) => jolt(d, t));
    expect([600, 750, 900, 1050].map((t) => jolt(d, t))).toEqual([false, false, false, false]);
    expect([4000, 4150, 4300, 4450].map((t) => jolt(d, t))).toEqual([false, false, false, true]);
  });
});

describe("boot line", () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  it("plays once per session", () => {
    const s = store();
    expect(shouldBoot(s, false)).toBe(true);
    expect(shouldBoot(s, false)).toBe(false);
  });
  it("never plays under reduced motion, and doesn't use up the session when it doesn't", () => {
    const s = store();
    expect(shouldBoot(s, true)).toBe(false);
    expect(shouldBoot(s, false)).toBe(true);
  });
  it("skips (doesn't throw) when storage is unavailable or throws", () => {
    expect(shouldBoot(null, false)).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    };
    expect(shouldBoot(broken, false)).toBe(false);
  });
  it("is a half-second line", () => expect(BOOT_MS).toBe(500));
});

describe("haptics", () => {
  afterEach(() => vi.unstubAllGlobals());
  const env = (vibrate: unknown, reduced: boolean) => {
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: reduced }) });
  };
  it("vibrates 8 ms where supported", () => {
    const v = vi.fn(() => true);
    env(v, false);
    expect(haptic()).toBe(true);
    expect(v).toHaveBeenCalledWith(8);
  });
  it("does nothing without navigator.vibrate (iOS) or under reduced motion, and never throws", () => {
    env(undefined, false);
    expect(haptic()).toBe(false);
    const v = vi.fn();
    env(v, true);
    expect(haptic()).toBe(false);
    expect(v).not.toHaveBeenCalled();
    env(() => {
      throw new Error("nope");
    }, false);
    expect(haptic()).toBe(false);
  });
});
