import { describe, expect, it } from "vitest";
import { ROWS, glyphBitmap, layoutText, renderText } from "@/lib/pixel/text";

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

describe("every glyph, square by square (A8)", () => {
  it.each([
    ["L", ["X....", "X....", "X....", "X....", "X....", "X....", "XXXXX"]],
    ["E", ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"]],
    ["T", ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."]],
    ["'", ["X", "X", ".", ".", ".", ".", "."]],
    ["S", [".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX."]],
    ["B", ["XXXX.", "X...X", "X...X", "XXXX.", "X...X", "X...X", "XXXX."]],
    ["U", ["X...X", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."]],
    ["I", ["XXX", ".X.", ".X.", ".X.", ".X.", ".X.", "XXX"]],
    ["D", ["XXXX.", "X...X", "X...X", "X...X", "X...X", "X...X", "XXXX."]],
  ])("%s", (ch, expected) => {
    expect(glyphBitmap(ch)).toEqual(expected);
  });

  it("the apostrophe is a straight tick at the top, one square wide, never leaning into the T", () => {
    const art = renderText("T'S");
    // T (5) + gap + ' (1) + gap + S (5)
    expect(art[0]).toBe("XXXXX.X..XXXX");
    expect(art[1]).toBe("..X...X.X....");
    expect(art[2]).toBe("..X.....X....");
  });

  it("LET'S BUILD reads as drawn", () => {
    expect(renderText("LET'S BUILD")).toEqual([
      "X.....XXXXX.XXXXX.X..XXXX.....XXXX..X...X.XXX.X.....XXXX.",
      "X.....X.......X...X.X.........X...X.X...X..X..X.....X...X",
      "X.....X.......X.....X.........X...X.X...X..X..X.....X...X",
      "X.....XXXX....X......XXX......XXXX..X...X..X..X.....X...X",
      "X.....X.......X.........X.....X...X.X...X..X..X.....X...X",
      "X.....X.......X.........X.....X...X.X...X..X..X.....X...X",
      "XXXXX.XXXXX...X.....XXXX......XXXX...XXX..XXX.XXXXX.XXXX.",
    ]);
  });
});
