/**
 * Shake detection for the CosmoStrike easter egg. Pure: feed it acceleration samples (m/s², with or
 * without gravity removed) and it says when a deliberate shake happened: `shakes` hard jolts, each at
 * least `gapMs` apart, inside `windowMs`. A bumpy bus ride is a few weak jolts; a shake is several strong ones.
 */
export function createShakeDetector({
  threshold = 18,
  shakes = 4,
  gapMs = 90,
  windowMs = 1100,
  cooldownMs = 3000,
}: { threshold?: number; shakes?: number; gapMs?: number; windowMs?: number; cooldownMs?: number } = {}) {
  let peaks: number[] = [];
  let lastFired = -Infinity;
  return {
    push(x: number, y: number, z: number, t: number): boolean {
      if (t - lastFired < cooldownMs) return false;
      if (Math.hypot(x, y, z) < threshold) return false;
      if (peaks.length && t - peaks[peaks.length - 1]! < gapMs) return false; // same jolt
      peaks = [...peaks.filter((p) => t - p <= windowMs), t];
      if (peaks.length < shakes) return false;
      peaks = [];
      lastFired = t;
      return true;
    },
  };
}
