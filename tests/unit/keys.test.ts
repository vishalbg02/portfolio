import { describe, expect, it } from "vitest";
import { CHORD_MS, GOTO, createChord, stepSection } from "@/lib/keys";

describe("g chords", () => {
  it("g then a letter jumps; the letters are the ones the help overlay lists", () => {
    const c = createChord();
    expect(c.feed("g", 0)).toBeNull();
    expect(c.armed(10)).toBe(true);
    expect(c.feed("w", 200)).toEqual({ type: "goto", id: "work", label: "Work" });
    expect(c.armed(300)).toBe(false); // used up
    for (const [k, v] of Object.entries(GOTO)) {
      c.feed("g", 1000);
      expect(c.feed(k.toUpperCase(), 1100)).toEqual({ type: "goto", id: v.id, label: v.label });
    }
    expect(Object.keys(GOTO).sort()).toEqual(["a", "c", "e", "g", "h", "s", "w"]);
  });

  it("the g prefix expires, and any other key cancels it and still does its own job", () => {
    const c = createChord();
    c.feed("g", 0);
    expect(c.feed("w", CHORD_MS + 1)).toBeNull(); // too late: a plain w does nothing
    c.feed("g", 5000);
    expect(c.feed("j", 5100)).toEqual({ type: "next" }); // not a destination, so it is j
    expect(c.feed("w", 5200)).toBeNull(); // and the chord is gone
  });

  it("j, k and t are single keys; an unknown key does nothing", () => {
    const c = createChord();
    expect(c.feed("j", 0)).toEqual({ type: "next" });
    expect(c.feed("K", 0)).toEqual({ type: "prev" });
    expect(c.feed("t", 0)).toEqual({ type: "tour" });
    expect(c.feed("x", 0)).toBeNull();
    expect(c.feed("Enter", 0)).toBeNull();
  });
});

describe("stepSection", () => {
  // distances from the top of the viewport: two sections behind us, the third at the top, two ahead
  const tops = [-1800, -900, 0, 700, 1500];

  it("j goes to the first section below the top, k to the nearest one above it", () => {
    expect(stepSection(tops, 1)).toBe(3);
    expect(stepSection(tops, -1)).toBe(1);
  });

  it("from the middle of a section, k goes back to its own start first", () => {
    expect(stepSection([-400, 600, 1400], -1)).toBe(0);
    expect(stepSection([-400, 600, 1400], 1)).toBe(1);
  });

  it("at either end there is nowhere to go", () => {
    expect(stepSection([-50, -20], 1)).toBeNull();
    expect(stepSection([0, 600], -1)).toBeNull();
    expect(stepSection([], 1)).toBeNull();
  });
});
