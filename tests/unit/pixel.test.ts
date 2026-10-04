import { describe, expect, it } from "vitest";
import { ROWS, layoutText } from "@/lib/pixel/text";

describe("pixel font", () => {
  it("lays out LET'S BUILD inside a 7-row grid, with every cell on the grid", () => {
    const { cells, cols } = layoutText("LET'S BUILD");
    expect(cols).toBeGreaterThan(40);
    expect(cells.length).toBeGreaterThan(80);
    for (const c of cells) {
      expect(c.row).toBeGreaterThanOrEqual(0);
      expect(c.row).toBeLessThan(ROWS);
      expect(c.col).toBeGreaterThanOrEqual(0);
      expect(c.col).toBeLessThan(cols);
    }
    expect(new Set(cells.map((c) => `${c.col},${c.row}`)).size).toBe(cells.length); // no overlaps
  });
  it("a single letter keeps its shape (T has a full top bar and a centre stem)", () => {
    const { cells, cols } = layoutText("T");
    expect(cols).toBe(5);
    expect(cells.filter((c) => c.row === 0)).toHaveLength(5);
    expect(cells.filter((c) => c.col === 2)).toHaveLength(7);
  });
  it("is deterministic and refuses unknown glyphs", () => {
    expect(layoutText("LET'S BUILD")).toEqual(layoutText("let's build"));
    expect(() => layoutText("Z")).toThrow(/no glyph/);
  });
});
