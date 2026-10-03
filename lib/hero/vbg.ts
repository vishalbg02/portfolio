/**
 * Pixel contribution grid spelling "VBG": 7 letter rows surrounded by dim squares.
 * Pure + deterministic so it renders identically on server and client.
 */
export const GLYPHS = {
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01110"],
} as const;

export const VBG_WORD = ["V", "B", "G"] as const;
export const VBG_PAD_X = 2;
export const VBG_PAD_Y = 2;
const LETTER_GAP = 1;
const GLYPH_W = 5;
const GLYPH_H = 7;

export const VBG_COLS = VBG_PAD_X * 2 + GLYPH_W * 3 + LETTER_GAP * 2;
export const VBG_ROWS = VBG_PAD_Y * 2 + GLYPH_H;

export type VbgCell = { x: number; y: number; letter: boolean; level: 0 | 1 | 2 | 3 | 4 };

/** Small deterministic hash → [0,1). */
function noise(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function buildVbgGrid(): VbgCell[] {
  const letters = new Set<string>();
  VBG_WORD.forEach((ch, i) => {
    const ox = VBG_PAD_X + i * (GLYPH_W + LETTER_GAP);
    GLYPHS[ch].forEach((row, y) => {
      [...row].forEach((bit, x) => {
        if (bit === "1") letters.add(`${ox + x},${VBG_PAD_Y + y}`);
      });
    });
  });

  const cells: VbgCell[] = [];
  for (let y = 0; y < VBG_ROWS; y++) {
    for (let x = 0; x < VBG_COLS; x++) {
      const letter = letters.has(`${x},${y}`);
      cells.push({ x, y, letter, level: letter ? 4 : noise(x, y) > 0.78 ? 1 : 0 });
    }
  }
  return cells;
}
