/**
 * A tiny 5×7 pixel font (same approach as the VBG mark), drawn in contribution squares by PixelText: the closing
 * "LET'S BUILD" banner, the chapter numerals (01–06) and the footer's "VISHAL B G". Only the glyphs those need;
 * asking for anything else throws, so a typo fails the build.
 */
const G: Record<string, string[]> = {
  L: ["X....", "X....", "X....", "X....", "X....", "X....", "XXXXX"],
  E: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
  T: ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."],
  // a straight tick, one square wide: the old two-wide slant read as a comma leaning into the T
  "'": ["X", "X", ".", ".", ".", ".", "."],
  S: [".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX."],
  B: ["XXXX.", "X...X", "X...X", "XXXX.", "X...X", "X...X", "XXXX."],
  U: ["X...X", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
  I: ["XXX", ".X.", ".X.", ".X.", ".X.", ".X.", "XXX"],
  D: ["XXXX.", "X...X", "X...X", "X...X", "X...X", "X...X", "XXXX."],
  V: ["X...X", "X...X", "X...X", "X...X", "X...X", ".X.X.", "..X.."],
  H: ["X...X", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
  A: [".XXX.", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
  G: [".XXXX", "X....", "X....", "X..XX", "X...X", "X...X", ".XXX."],
  "0": [".XXX.", "X...X", "X..XX", "X.X.X", "XX..X", "X...X", ".XXX."],
  "1": ["..X..", ".XX..", "..X..", "..X..", "..X..", "..X..", ".XXX."],
  "2": [".XXX.", "X...X", "....X", "...X.", "..X..", ".X...", "XXXXX"],
  "3": ["XXXX.", "....X", "....X", ".XXX.", "....X", "....X", "XXXX."],
  "4": ["...X.", "..XX.", ".X.X.", "X..X.", "XXXXX", "...X.", "...X."],
  "5": ["XXXXX", "X....", "XXXX.", "....X", "....X", "X...X", ".XXX."],
  "6": [".XXX.", "X....", "X....", "XXXX.", "X...X", "X...X", ".XXX."],
  " ": ["...", "...", "...", "...", "...", "...", "..."],
};

export const ROWS = 7;

/** One glyph as its 7 rows of "X" (lit) and "." (dark), for tests and tools. Throws on a glyph the font lacks. */
export function glyphBitmap(ch: string): string[] {
  const g = G[ch.toUpperCase()];
  if (!g) throw new Error(`pixel font has no glyph for "${ch}"`);
  return [...g];
}

/** A line of text as ASCII art (rows of "X" and "."), exactly as layoutText places it. */
export function renderText(text: string): string[] {
  const { cells, cols } = layoutText(text);
  const rows = Array.from({ length: ROWS }, () => Array.from({ length: cols }, () => "."));
  for (const c of cells) rows[c.row]![c.col] = "X";
  return rows.map((r) => r.join(""));
}
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
