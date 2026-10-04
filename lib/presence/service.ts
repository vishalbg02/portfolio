import "server-only";
import { getHereStore } from "./store";
import { SNAPSHOT_MS, litCells, type HereView } from "./wall";

const LIMIT = 400;
let cache: { at: number; ids: string[] } | null = null;

/** For tests: forget the cached snapshot. */
export const resetHereCache = () => {
  cache = null;
};

/**
 * One heartbeat: record it, then say who is here. The recorded visitor is always in the answer (so a visitor sees their own
 * square at once, even if the cached list is a few seconds old). Without Redis, or if it hiccups, the answer is
 * "not configured" and the wall just stays dim: it never fails the page.
 */
export async function heartbeat(id: string, now: number = Date.now()): Promise<HereView> {
  const store = getHereStore();
  if (!store) return { configured: false, count: 0, cells: [] };
  try {
    await store.beat(id, now);
    if (!cache || now - cache.at >= SNAPSHOT_MS) cache = { at: now, ids: await store.present(now, LIMIT) };
    // anyone who beats while the list is cached joins it, so the next answer includes them too
    if (!cache.ids.includes(id)) cache.ids = [...cache.ids, id];
    const ids = cache.ids;
    return { configured: true, count: ids.length, cells: litCells(ids) };
  } catch (err) {
    console.error("[presence] heartbeat failed:", (err as Error).message);
    return { configured: false, count: 0, cells: [] };
  }
}
