import { describe, expect, it } from "vitest";
import { greetingFor } from "@/lib/hero/greeting";
import { GLYPHS, VBG_COLS, VBG_PAD_Y, VBG_ROWS, buildVbgGrid } from "@/lib/hero/vbg";
import { DECAY_MS, RIPPLE_MS, TrailField, levelFor } from "@/lib/hero/trail";

describe("greetingFor", () => {
  it.each([
    [5, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [16, "Good afternoon"],
    [17, "Good evening"],
    [21, "Good evening"],
    [22, "Up late?"],
    [0, "Up late?"],
    [4, "Up late?"],
  ])("hour %i → %s", (hour, expected) => {
    expect(greetingFor(hour)).toBe(expected);
  });
});

describe("VBG grid", () => {
  const cells = buildVbgGrid();

  it("covers the full grid with unique coordinates", () => {
    expect(cells).toHaveLength(VBG_COLS * VBG_ROWS);
    expect(new Set(cells.map((c) => `${c.x},${c.y}`)).size).toBe(cells.length);
  });

  it("spells VBG across exactly 7 letter rows", () => {
    const letterRows = new Set(cells.filter((c) => c.letter).map((c) => c.y));
    expect([...letterRows].sort((a, b) => a - b)).toEqual(
      [2, 3, 4, 5, 6, 7, 8].map((y) => y - 2 + VBG_PAD_Y),
    );
    const litCount = Object.values(GLYPHS).reduce((n, g) => n + g.join("").replaceAll("0", "").length, 0);
    expect(cells.filter((c) => c.letter)).toHaveLength(litCount);
  });

  it("uses --grid-4 for letters and only levels 0/1 around them", () => {
    for (const c of cells) {
      if (c.letter) expect(c.level).toBe(4);
      else expect([0, 1]).toContain(c.level);
    }
  });

  it("is deterministic (server and client render the same grid)", () => {
    expect(buildVbgGrid()).toEqual(cells);
  });
});

describe("TrailField", () => {
  it("maps intensity to contribution levels", () => {
    expect(levelFor(1)).toBe(4);
    expect(levelFor(0.6)).toBe(3);
    expect(levelFor(0.3)).toBe(2);
    expect(levelFor(0.05)).toBe(1);
    expect(levelFor(0)).toBe(0);
  });

  it("lights cells near the cursor, brightest at the center", () => {
    const f = new TrailField(20, 10);
    f.stamp(10.5, 5.5);
    expect(f.intensityAt(10, 5)).toBeGreaterThan(f.intensityAt(12, 5));
    expect(f.intensityAt(10, 5)).toBe(1);
    expect(f.intensityAt(0, 0)).toBe(0);
    expect(f.idle).toBe(false);
  });

  it("fades back to idle in about DECAY_MS", () => {
    const f = new TrailField(20, 10);
    f.stamp(10.5, 5.5);
    let now = 0;
    for (; now < DECAY_MS + 50; now += 16) f.step(16, now);
    expect(f.idle).toBe(true);
    expect(f.intensityAt(10, 5)).toBe(0);
  });

  it("reports cells that just reached 0 so they get redrawn dim", () => {
    const f = new TrailField(5, 5);
    f.stamp(2.5, 2.5, 0.6);
    const seen = new Set<number>();
    for (let t = 0; t < DECAY_MS + 100; t += 50) for (const i of f.step(50, t)) seen.add(i);
    expect(seen.has(2 * 5 + 2)).toBe(true);
    expect(f.idle).toBe(true);
  });

  it("ignores stamps outside the grid", () => {
    const f = new TrailField(5, 5);
    f.stamp(-20, -20);
    f.stamp(100, 100);
    expect(f.idle).toBe(true);
  });

  it("expands a ripple ring outward and ends after RIPPLE_MS", () => {
    const f = new TrailField(40, 40);
    f.ripple(20, 20, 0);
    f.step(16, 300); // halfway: ring radius ≈ 4.5 cells
    expect(f.intensityAt(24, 20)).toBeGreaterThan(0); // on the ring
    expect(f.intensityAt(20, 20)).toBe(0); // inside the ring
    expect(f.intensityAt(34, 20)).toBe(0); // outside the ring
    for (let t = 316; t <= RIPPLE_MS + DECAY_MS + 100; t += 16) f.step(16, t);
    expect(f.idle).toBe(true);
  });
});
