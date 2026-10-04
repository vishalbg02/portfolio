/**
 * The visitor wall: each person on the site right now lights one square, anonymously. Shared by server and browser.
 * A visitor is "here" while their browser keeps sending a heartbeat; there is no account, no cookie and no IP in it,
 * only a random id made for this tab (sessionStorage) that decides which square lights.
 */
export const COLS = 32;
export const ROWS = 7;
export const CELLS = COLS * ROWS;
/** How often a visible tab says "still here", and how long after the last one a visitor still counts. */
export const BEAT_MS = 30_000;
export const HERE_MS = 75_000;
/** A tab left open stops sending after this long (it drops off the wall a minute later), so an idle tab costs nothing. */
export const MAX_BEATING_MS = 30 * 60_000;
/** The server re-reads who is here at most this often per instance. */
export const SNAPSHOT_MS = 15_000;

export const validVisitor = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9]{10,24}$/.test(v);

/** The square a visitor lights: a stable hash of the id (FNV-1a), so a reload keeps the same square. */
export function cellFor(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % CELLS;
}

/** The distinct squares lit by these visitors, in order. Two visitors on one square light it once (the count is still two). */
export const litCells = (ids: string[]): number[] => [...new Set(ids.map(cellFor))].sort((a, b) => a - b);

export type HereView = { configured: boolean; count: number; cells: number[] };

/** "3 people here now" (and "just you" when it is only the visitor). */
export function hereLabel(count: number): string {
  if (count <= 1) return "Just you here right now";
  return `${count} people here now`;
}
