import { track } from "@/lib/analytics";

/**
 * Explorer achievements: finding the site's hidden features lights squares on the Grid Rail and counts toward
 * "N/8 discovered" in the footer. Stored in this browser's localStorage only (every access in try/catch: private
 * windows, blocked storage); the only thing that leaves the browser is the anonymous `secret_found` event with the
 * achievement's id, the same kind of event the easter eggs already send.
 */
export const ACHIEVEMENTS = [
  { id: "terminal", label: "Opened the terminal", hint: "Press ~ (the key under Esc)" },
  { id: "command", label: "Ran a terminal command", hint: "Open the terminal and type help" },
  { id: "snake", label: "Played Snake", hint: "It lives on the 404 page" },
  { id: "cosmostrike", label: "Found CosmoStrike", hint: "The Konami code opens it" },
  { id: "tour", label: "Took the tour", hint: "Press t, or choose the tour in the Omnibar" },
  { id: "grid", label: "Asked GRID", hint: "Press / and ask anything" },
  { id: "city", label: "Switched to the 3D city", hint: "Activity has a second view" },
  { id: "omnibar", label: "Ran a command from the Omnibar", hint: "Press ⌘K, then pick a command" },
] as const;

export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];
export const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((a) => a.id) as readonly AchievementId[];
export const STORAGE_KEY = "ach:v1";
export const ACH_EVENT = "app:achievement";

const valid = (v: unknown): v is AchievementId => ACHIEVEMENT_IDS.includes(v as AchievementId);

/** The stored ids, de-duplicated and limited to known ones, in the order they are defined. */
export function parse(raw: string | null): AchievementId[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    const found = new Set(list.filter(valid));
    return ACHIEVEMENT_IDS.filter((id) => found.has(id));
  } catch {
    return [];
  }
}

const storage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const readUnlocked = (): AchievementId[] => parse(storage()?.getItem(STORAGE_KEY) ?? null);

/** Raw stored value, for useSyncExternalStore (a string is a stable snapshot). */
export const snapshot = () => storage()?.getItem(STORAGE_KEY) ?? "";

/**
 * Marks one found. Returns true the first time. Tells the page (the rail and the footer listen) and counts the
 * discovery anonymously. Safe to call as often as you like.
 */
export function unlock(id: AchievementId): boolean {
  if (typeof window === "undefined") return false;
  const have = readUnlocked();
  if (have.includes(id)) return false;
  const next = ACHIEVEMENT_IDS.filter((x) => x === id || have.includes(x));
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* blocked: it still counts for this visit */
  }
  window.dispatchEvent(new CustomEvent(ACH_EVENT, { detail: { id, count: next.length } }));
  track("secret_found", { name: id });
  return true;
}

export function subscribe(cb: () => void) {
  window.addEventListener(ACH_EVENT, cb);
  window.addEventListener("storage", cb); // another tab found one
  return () => {
    window.removeEventListener(ACH_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
