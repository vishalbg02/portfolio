import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CURSOR_LABELS, snap } from "@/components/delight/ContextCursor";
import { wire } from "@/components/sections/StackExplorer";
import { buttonClass } from "@/components/ui/Button";
import { gridFor, noise } from "@/lib/fx/dissolve";

describe("context cursor", () => {
  it("snaps to the 4 px grid and names exactly five things", () => {
    for (const n of [0, 1, 2, 3, 5, 6, 7, 102, 1439, -3]) expect(Math.abs(snap(n)) % 4).toBe(0);
    expect(snap(5)).toBe(4);
    expect(snap(6)).toBe(8);
    expect(CURSOR_LABELS).toEqual(["open", "play", "drag", "copy", "ask"]);
  });
});

describe("Stack wires", () => {
  it("run from the skill to the project in one smooth curve, and mirror when the ends swap", () => {
    const a = { x: 100, y: 40 };
    const b = { x: 500, y: 300 };
    expect(wire(a, b)).toBe("M100 40C300 40 300 300 500 300");
    expect(wire(a, a)).toBe("M100 40C100 40 100 40 100 40");
    // the same wire seen from the other end passes through the same two control x positions
    expect(wire(b, a)).toBe("M500 300C300 300 300 40 100 40");
  });
});

describe("pixel dissolve helpers", () => {
  it("noise is stable per square and pass, and spread across [0, 1)", () => {
    expect(noise(7, 1)).toBe(noise(7, 1));
    expect(noise(7, 1)).not.toBe(noise(7, 2));
    const xs = Array.from({ length: 400 }, (_, i) => noise(i, 0));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(xs.filter((x) => x < 0.5).length).toBeGreaterThan(150);
    expect(xs.filter((x) => x < 0.5).length).toBeLessThan(250);
  });

  it("the grid is as many squares as fit, never fewer than 4 by 3", () => {
    expect(gridFor(1280, 720, 72)).toEqual({ cols: 18, rows: 10 });
    expect(gridFor(10, 10, 72)).toEqual({ cols: 4, rows: 3 });
  });
});

describe("button fill", () => {
  it("every variant carries the sweep and its own fill colour; the solid one keeps a reduced-motion hover", () => {
    for (const v of ["solid", "outline", "ghost"] as const) {
      const cls = buttonClass(v);
      expect(cls).toContain("btn-fill");
      expect(cls).toMatch(/\[--fill:var\(--[a-z0-9-]+\)\]/);
    }
    expect(buttonClass("outline")).toContain("btn-fill-flip");
    expect(buttonClass("solid")).toContain("motion-reduce:hover:");
  });

  it("the sweep and the context cursor's motion exist only where motion is allowed, and nothing is a gradient", () => {
    const css = readFileSync("styles/fx.css", "utf8");
    const guarded = css.slice(
      css.indexOf("@media (prefers-reduced-motion: no-preference)", css.indexOf("Button hover")),
    );
    expect(guarded).toContain(".btn-fill::before");
    expect(guarded.indexOf(".btn-fill::before")).toBeLessThan(guarded.indexOf("}\n}"));
    expect(css).toContain("steps(5, end)");
    expect(css).not.toMatch(/gradient\(/);
    // the lit Stack wire only dashes when motion is allowed
    const wireRule = css.slice(css.indexOf(".stack-wire {") - 80, css.indexOf(".stack-wire {") + 160);
    expect(wireRule).toContain("prefers-reduced-motion: no-preference");
  });
});
