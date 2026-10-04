/**
 * The site's signature transition: the content dissolves into contribution squares, `swap()` runs while
 * the squares cover it, and the squares then clear to reveal the new state. Flat colours from the grid
 * palette, a coarse grid, 220–320 ms. Shared by the Work scenes, route changes and modals.
 * Reduced motion (or no Web Animations) = an instant swap.
 */
/** Mostly the dark and middle greens, now and then a bright one: it reads as activity, not as a flash. */
const LEVELS = [
  "var(--grid-1)",
  "var(--grid-1)",
  "var(--grid-1)",
  "var(--grid-2)",
  "var(--grid-2)",
  "var(--grid-2)",
  "var(--grid-3)",
  "var(--grid-3)",
  "var(--grid-4)",
];

export type DissolveOptions = {
  /** Square size in px (the grid is as many as fit). */
  cell?: number;
  /** Total time in ms, cover plus reveal. */
  ms?: number;
};

/** A stable pseudo-random number in [0, 1) for a square and a pass, so the pattern is the same every time. */
export function noise(i: number, pass: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(pass + 1, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return ((h >>> 0) % 10_000) / 10_000;
}

/** Grid size for a box: as many `cell`-px squares as fit, never fewer than 4 × 3. */
export function gridFor(width: number, height: number, cell: number) {
  return { cols: Math.max(4, Math.ceil(width / cell)), rows: Math.max(3, Math.ceil(height / cell)) };
}

export async function dissolve(
  host: HTMLElement,
  swap: () => void,
  { cell = 64, ms = 300 }: DissolveOptions = {},
): Promise<void> {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof host.animate !== "function") {
    swap();
    return;
  }
  const box = host.getBoundingClientRect();
  const { cols, rows } = gridFor(box.width, box.height, cell);

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = `position:absolute;inset:0;z-index:30;pointer-events:none;overflow:hidden;display:grid;grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr);`;
  const cells = Array.from({ length: cols * rows }, (_, i) => {
    const s = document.createElement("span");
    s.style.background = LEVELS[Math.floor(noise(i, 2) * LEVELS.length)]!;
    s.style.opacity = "0";
    layer.appendChild(s);
    return s;
  });
  host.appendChild(layer);

  const part = ms * 0.3; // how long one square takes
  const spread = ms * 0.2; // how far apart their starts are
  const run = (from: number, to: number, pass: number) =>
    Promise.all(
      cells.map(
        (s, i) =>
          s.animate([{ opacity: from }, { opacity: to }], {
            duration: part,
            delay: noise(i, pass) * spread,
            easing: "steps(3, end)",
            fill: "forwards",
          }).finished,
      ),
    );

  try {
    await run(0, 1, 0);
    swap();
    await run(1, 0, 1);
  } catch {
    swap(); // an interrupted animation must never leave the old state on screen
  } finally {
    layer.remove();
  }
}
