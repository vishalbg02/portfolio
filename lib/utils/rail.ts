/** Pure helpers for the Grid Rail (kept out of the component so they can be unit-tested). */

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Scroll progress 0..1 (0 when the page doesn't scroll). */
export function scrollProgress(scrollY: number, docHeight: number, viewport: number): number {
  const max = docHeight - viewport;
  return max <= 0 ? 0 : clamp01(scrollY / max);
}

/**
 * Level (0–4) of each of `count` rail squares for a given progress. Squares fill top to bottom:
 * each one climbs 0 → 4 while the page scroll passes its slot, so the rail reads like a
 * contribution graph filling up.
 */
export function railLevels(progress: number, count: number): number[] {
  const p = clamp01(progress) * count;
  return Array.from({ length: count }, (_, i) => Math.round(4 * clamp01(p - i)));
}

/** Position of each section on the rail as a 0..1 fraction of the document. */
export function tickFractions(offsets: number[], docHeight: number, viewport: number): number[] {
  // A page that fits the viewport has no scroll range: spread the sections over the page height.
  const range = docHeight - viewport;
  const max = range > 1 ? range : Math.max(1, docHeight);
  return offsets.map((o) => clamp01(o / max));
}

/** Index of the section the reader is in: the last one whose top is at or above the marker line. */
export function activeSection(tops: number[], scrollY: number, markerOffset: number): number {
  let idx = -1;
  tops.forEach((t, i) => {
    if (t - markerOffset <= scrollY) idx = i;
  });
  return idx;
}

/**
 * Keeps neighbouring ticks at least `minPx` apart (WCAG 2.2 target size/spacing) on a rail that is
 * `railPx` tall, preserving order. Positions are fractions 0..1 of the rail; non-finite entries
 * (sections missing from the page) are ignored and returned untouched.
 */
export function spreadTicks(fractions: number[], railPx: number, minPx = 28): number[] {
  const out = [...fractions];
  const idx = out.map((f, i) => (Number.isFinite(f) ? i : -1)).filter((i) => i >= 0);
  const gap = railPx > 0 ? minPx / railPx : 0;
  // push down
  for (let k = 1; k < idx.length; k++) {
    const prev = out[idx[k - 1]!]!;
    if (out[idx[k]!]! < prev + gap) out[idx[k]!] = prev + gap;
  }
  // if we ran off the end, pull everything back up
  for (let k = idx.length - 1; k >= 0; k--) {
    const limit = k === idx.length - 1 ? 1 : out[idx[k + 1]!]! - gap;
    if (out[idx[k]!]! > limit) out[idx[k]!] = limit;
  }
  return out.map((f) => (Number.isFinite(f) ? clamp01(f) : f));
}
