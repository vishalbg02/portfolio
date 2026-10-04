/**
 * A tiny 5×7 pixel font (same approach as the VBG mark) for the closing "LET'S BUILD" banner.
 * Only the glyphs the banner needs; asking for anything else throws, so a typo fails the build.
 */
const G: Record<string, string[]> = {
  L: ["X....", "X....", "X....", "X....", "X....", "X....", "XXXXX"],
  E: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
  T: ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."],
  "'": [".X", ".X", "X.", "..", "..", "..", ".."],
  S: [".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX."],
  B: ["XXXX.", "X...X", "X...X", "XXXX.", "X...X", "X...X", "XXXX."],
  U: ["X...X", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
  I: ["XXX", ".X.", ".X.", ".X.", ".X.", ".X.", "XXX"],
  D: ["XXXX.", "X...X", "X...X", "X...X", "X...X", "X...X", "XXXX."],
  " ": ["...", "...", "...", "...", "...", "...", "..."],
};

export const ROWS = 7;
export type PixelCell = { col: number; row: number };

/** Lit cells and total width (columns) of a line of text, one empty column between glyphs. */
export function layoutText(text: string): { cells: PixelCell[]; cols: number } {
  const cells: PixelCell[] = [];
  let col = 0;
  for (const ch of text.toUpperCase()) {
    const glyph = G[ch];
    if (!glyph) throw new Error(`pixel font has no glyph for "${ch}"`);
    glyph.forEach((line, row) =>
      [...line].forEach((c, i) => {
        if (c === "X") cells.push({ col: col + i, row });
      }),
    );
    col += glyph[0]!.length + 1;
  }
  return { cells, cols: col - 1 };
}
