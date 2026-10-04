/**
 * A tiny tap of vibration (8 ms) on primary taps, where the browser supports it. iOS Safari has no
 * `navigator.vibrate`, so it is simply a no-op there. Never under reduced motion, never throws.
 */
export function haptic(ms = 8): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return navigator.vibrate(ms);
  } catch {
    return false;
  }
}
