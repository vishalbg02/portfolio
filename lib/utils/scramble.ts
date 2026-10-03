/**
 * "Decode" effect helper: pure, so the final frame is provably the real text.
 * Characters are revealed left to right; the rest show random mono glyphs. Spaces never scramble
 * (so line breaks and layout width never change), and `scramble(text, 1)` always equals `text`.
 */
export const GLYPHS = "01{}[]<>/\\=+-_*#$%&@!?:;";

export type Rng = () => number;

export function scramble(source: string, progress: number, rng: Rng = Math.random): string {
  const p = Math.min(1, Math.max(0, progress));
  const chars = [...source];
  const reveal = Math.floor(p * chars.length);
  return chars
    .map((ch, i) => (i < reveal || /\s/.test(ch) || p >= 1 ? ch : GLYPHS[Math.floor(rng() * GLYPHS.length)]!))
    .join("");
}

/** Tiny deterministic RNG (mulberry32) for tests and for stable server markup. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
