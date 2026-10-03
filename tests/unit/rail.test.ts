import { describe, expect, it } from "vitest";
import { GLYPHS, scramble, seeded } from "@/lib/utils/scramble";
import { activeSection, railLevels, scrollProgress, spreadTicks, tickFractions } from "@/lib/utils/rail";

describe("scramble (decode headers)", () => {
  const samples = ["Work", "{ } WORK", "Where I've shipped", "Live from GitHub", "", "a", "Résumé · 2026"];

  it("the final frame always equals the source text", () => {
    for (const s of samples) {
      expect(scramble(s, 1)).toBe(s);
      expect(scramble(s, 1, seeded(1))).toBe(s);
      expect(scramble(s, 5)).toBe(s); // out-of-range clamps
    }
  });

  it("keeps length and spaces on every frame, and reveals left to right", () => {
    const s = "Where I've shipped";
    for (let p = 0; p <= 1; p += 0.1) {
      const f = scramble(s, p, seeded(7));
      expect([...f]).toHaveLength([...s].length);
      [...s].forEach((ch, i) => {
        if (/\s/.test(ch)) expect([...f][i]).toBe(ch);
      });
      const revealed = Math.floor(p * s.length);
      expect(f.slice(0, revealed)).toBe(s.slice(0, revealed));
    }
  });

  it("only uses mono glyphs for the unrevealed part, and is deterministic with a seed", () => {
    const a = scramble("Experience", 0, seeded(3));
    expect(a).toBe(scramble("Experience", 0, seeded(3)));
    for (const ch of a) expect(GLYPHS).toContain(ch);
  });
});

describe("grid rail maths", () => {
  it("progress is clamped and zero for pages that don't scroll", () => {
    expect(scrollProgress(0, 800, 800)).toBe(0);
    expect(scrollProgress(500, 600, 800)).toBe(0);
    expect(scrollProgress(-20, 3000, 1000)).toBe(0);
    expect(scrollProgress(1000, 3000, 1000)).toBe(0.5);
    expect(scrollProgress(5000, 3000, 1000)).toBe(1);
  });

  it("levels fill top to bottom, 0 at the top and all 4 at the bottom", () => {
    expect(railLevels(0, 10)).toEqual(Array(10).fill(0));
    expect(railLevels(1, 10)).toEqual(Array(10).fill(4));
    const half = railLevels(0.5, 10);
    expect(half.slice(0, 5)).toEqual([4, 4, 4, 4, 4]);
    expect(half.slice(5)).toEqual([0, 0, 0, 0, 0]);
    // mid-way through a slot the square is partially filled
    const mid = railLevels(0.25, 10);
    expect(mid[2]).toBe(2);
    expect(mid[3]).toBe(0);
    for (const l of railLevels(0.37, 24)) expect([0, 1, 2, 3, 4]).toContain(l);
  });

  it("levels never decrease from top to bottom as progress grows", () => {
    for (let p = 0; p <= 1; p += 0.05) {
      const l = railLevels(p, 20);
      for (let i = 1; i < l.length; i++) expect(l[i]!).toBeLessThanOrEqual(l[i - 1]!);
    }
  });

  it("maps section offsets to rail fractions", () => {
    expect(tickFractions([0, 1000, 2000], 3000, 1000)).toEqual([0, 0.5, 1]);
    expect(tickFractions([3500], 3000, 1000)).toEqual([1]);
    expect(tickFractions([10], 500, 800)).toEqual([0.02]);
  });

  it("finds the active section from scroll position", () => {
    const tops = [800, 1600, 2400];
    expect(activeSection(tops, 0, 200)).toBe(-1);
    expect(activeSection(tops, 650, 200)).toBe(0);
    expect(activeSection(tops, 1500, 200)).toBe(1);
    expect(activeSection(tops, 99999, 200)).toBe(2);
  });
});

describe("tick spacing (WCAG 2.2 target spacing)", () => {
  it("keeps neighbouring ticks at least 28px apart, in order, inside the rail", () => {
    const out = spreadTicks([0.1, 0.12, 0.13, 0.5, 0.99, 1], 400, 28);
    for (let i = 1; i < out.length; i++)
      expect((out[i]! - out[i - 1]!) * 400).toBeGreaterThanOrEqual(28 - 1e-9);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...out)).toBeLessThanOrEqual(1);
  });
  it("leaves well-spaced ticks alone and ignores missing sections", () => {
    expect(spreadTicks([0, 0.5, 1], 400)).toEqual([0, 0.5, 1]);
    const out = spreadTicks([0.2, Number.POSITIVE_INFINITY, 0.21], 400);
    expect(out[1]).toBe(Number.POSITIVE_INFINITY);
    expect((out[2]! - out[0]!) * 400).toBeGreaterThanOrEqual(28 - 1e-9);
  });
});
