/** Events that open the lazy "delight" overlays. Dispatching them is free; the code loads on demand. */
export const OPEN_TERMINAL_EVENT = "app:open-terminal";
export const OPEN_GAME_EVENT = "app:open-game";

export const openTerminal = () => window.dispatchEvent(new Event(OPEN_TERMINAL_EVENT));
export const openCosmoStrike = () => window.dispatchEvent(new Event(OPEN_GAME_EVENT));

export const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;

/**
 * Feeds one key into the Konami matcher and returns the new progress (10 = unlocked). Pure.
 * On a wrong key it falls back to the longest prefix still matched by the keys typed so far
 * (so a stray extra "up" doesn't force a full restart).
 */
export function konamiProgress(progress: number, key: string): number {
  const norm = key.length === 1 ? key.toLowerCase() : key;
  const typed = [...KONAMI.slice(0, progress), norm];
  for (let k = Math.min(typed.length, KONAMI.length); k > 0; k--) {
    if (typed.slice(typed.length - k).every((t, i) => t === KONAMI[i])) return k;
  }
  return 0;
}
