/**
 * Contribution-grid cursor trail: pure simulation (no DOM) so it can be unit-tested.
 * Cells hold an intensity in (0, 1]; it decays to 0 over DECAY_MS and maps to --grid-0…4.
 */
export const DECAY_MS = 600;
export const RIPPLE_MS = 600;
export const RIPPLE_MAX_RADIUS = 9; // cells
const RIPPLE_BAND = 1.3; // ring thickness in cells

export type Level = 0 | 1 | 2 | 3 | 4;

export function levelFor(intensity: number): Level {
  if (intensity >= 0.75) return 4;
  if (intensity >= 0.5) return 3;
  if (intensity >= 0.25) return 2;
  if (intensity > 0) return 1;
  return 0;
}

type Ripple = { cx: number; cy: number; t0: number };

export class TrailField {
  readonly cols: number;
  readonly rows: number;
  private active = new Map<number, number>();
  private ripples: Ripple[] = [];

  constructor(cols: number, rows: number) {
    this.cols = Math.max(1, cols);
    this.rows = Math.max(1, rows);
  }

  get idle(): boolean {
    return this.active.size === 0 && this.ripples.length === 0;
  }

  intensityAt(col: number, row: number): number {
    return this.active.get(row * this.cols + col) ?? 0;
  }

  private raise(col: number, row: number, value: number) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows || value <= 0) return;
    const i = row * this.cols + col;
    if (value > (this.active.get(i) ?? 0)) this.active.set(i, Math.min(1, value));
  }

  /** Light cells around a pointer position given in (fractional) cell coordinates. */
  stamp(cx: number, cy: number, radius = 2.6) {
    const r = Math.ceil(radius);
    const c0 = Math.floor(cx);
    const r0 = Math.floor(cy);
    for (let row = r0 - r; row <= r0 + r; row++) {
      for (let col = c0 - r; col <= c0 + r; col++) {
        const d = Math.hypot(col + 0.5 - cx, row + 0.5 - cy);
        if (d <= radius) this.raise(col, row, 1 - 0.55 * (d / radius));
      }
    }
  }

  /** Start an expanding ring (touch tap). */
  ripple(cx: number, cy: number, now: number) {
    this.ripples.push({ cx, cy, t0: now });
  }

  /** Advances the simulation. Returns every cell index that needs redrawing (including cells that just reached 0). */
  step(dtMs: number, now: number): number[] {
    const decay = dtMs / DECAY_MS;
    for (const [i, v] of this.active) {
      const next = v - decay;
      if (next <= 0) this.active.set(i, 0);
      else this.active.set(i, next);
    }

    this.ripples = this.ripples.filter((rp) => now - rp.t0 < RIPPLE_MS);
    for (const rp of this.ripples) {
      const age = now - rp.t0;
      const radius = (age / RIPPLE_MS) * RIPPLE_MAX_RADIUS;
      const strength = 1 - age / RIPPLE_MS;
      const reach = Math.ceil(radius + RIPPLE_BAND);
      const c0 = Math.floor(rp.cx);
      const r0 = Math.floor(rp.cy);
      for (let row = r0 - reach; row <= r0 + reach; row++) {
        for (let col = c0 - reach; col <= c0 + reach; col++) {
          const off = Math.abs(Math.hypot(col + 0.5 - rp.cx, row + 0.5 - rp.cy) - radius);
          if (off <= RIPPLE_BAND) this.raise(col, row, strength * (1 - off / RIPPLE_BAND));
        }
      }
    }

    const changed = [...this.active.keys()];
    for (const [i, v] of this.active) if (v === 0) this.active.delete(i);
    return changed;
  }
}
