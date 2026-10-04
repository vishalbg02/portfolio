import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BEAT_MS,
  CELLS,
  COLS,
  HERE_MS,
  ROWS,
  cellFor,
  hereLabel,
  litCells,
  validVisitor,
} from "@/lib/presence/wall";

describe("visitor wall maths", () => {
  it("is a year-shaped grid, and a visitor always lights the same square", () => {
    expect(CELLS).toBe(COLS * ROWS);
    expect(COLS * ROWS).toBe(224);
    for (const id of ["abcdefghij", "k3j4h5g6f7d8s9a0", "zzzzzzzzzz"]) {
      expect(cellFor(id)).toBe(cellFor(id));
      expect(cellFor(id)).toBeGreaterThanOrEqual(0);
      expect(cellFor(id)).toBeLessThan(CELLS);
    }
  });

  it("spreads visitors over the wall (not all in one corner)", () => {
    const ids = Array.from({ length: 400 }, (_, i) => `v${i.toString(36).padStart(9, "0")}`);
    const cells = new Set(ids.map(cellFor));
    expect(cells.size).toBeGreaterThan(130);
    const left = ids.filter((id) => cellFor(id) < CELLS / 2).length;
    expect(left).toBeGreaterThan(150);
    expect(left).toBeLessThan(250);
  });

  it("two visitors on one square light it once; the count is separate", () => {
    const a = "aaaaaaaaaa";
    expect(litCells([a, a, "bbbbbbbbbb"]).length).toBeLessThanOrEqual(2);
    expect(litCells([])).toEqual([]);
    expect(litCells(["bbbbbbbbbb", a])).toEqual([...litCells([a, "bbbbbbbbbb"])]); // sorted
  });

  it("accepts only the random ids a tab makes", () => {
    expect(validVisitor("abc123def4")).toBe(true);
    for (const bad of ["", "short", "UPPERCASE12", "has space 12", "a".repeat(40), "<script>12", 7, null])
      expect(validVisitor(bad), String(bad)).toBe(false);
  });

  it("a visitor counts for a bit longer than two beats, and the label is plain", () => {
    expect(HERE_MS).toBeGreaterThan(2 * BEAT_MS);
    expect(hereLabel(0)).toBe("Just you here right now");
    expect(hereLabel(1)).toBe("Just you here right now");
    expect(hereLabel(2)).toBe("2 people here now");
    expect(hereLabel(40)).toBe("40 people here now");
  });
});

describe("heartbeat service", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/presence/store");
  });

  async function load() {
    vi.doMock("@/lib/env", () => ({ features: { upstash: true } }));
    const { MemoryHereStore, setHereStoreForTests } =
      await vi.importActual<typeof import("@/lib/presence/store")>("@/lib/presence/store");
    const store = new MemoryHereStore();
    setHereStoreForTests(store);
    const svc = await import("@/lib/presence/service");
    svc.resetHereCache();
    return { svc, store };
  }

  it("counts the visitor at once, then everyone who beat within the window; the oldest drop off", async () => {
    const { svc } = await load();
    const t = 1_000_000;
    expect(await svc.heartbeat("aaaaaaaaaa", t)).toMatchObject({ configured: true, count: 1 });
    svc.resetHereCache();
    const two = await svc.heartbeat("bbbbbbbbbb", t + 1000);
    expect(two.count).toBe(2);
    expect(two.cells.length).toBeGreaterThanOrEqual(1);
    svc.resetHereCache();
    const later = await svc.heartbeat("bbbbbbbbbb", t + HERE_MS + 5000); // a has not beaten for over the window
    expect(later.count).toBe(1);
  });

  it("reads who is here at most every 15 seconds per instance, but a visitor always sees their own square", async () => {
    const { svc, store } = await load();
    const present = vi.spyOn(store, "present");
    await svc.heartbeat("aaaaaaaaaa", 1_000_000);
    await svc.heartbeat("bbbbbbbbbb", 1_005_000);
    await svc.heartbeat("cccccccccc", 1_010_000);
    expect(present).toHaveBeenCalledTimes(1);
    const v = await svc.heartbeat("dddddddddd", 1_012_000);
    expect(v.count).toBeGreaterThanOrEqual(4); // the cached list plus the one who just beat
    await svc.heartbeat("eeeeeeeeee", 1_020_000);
    expect(present).toHaveBeenCalledTimes(2);
  });

  it("without Redis, or if it fails, says not configured and never throws", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ features: { upstash: false } }));
    const off = await import("@/lib/presence/service");
    expect(await off.heartbeat("aaaaaaaaaa")).toEqual({ configured: false, count: 0, cells: [] });
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ features: { upstash: true } }));
    const { setHereStoreForTests } =
      await vi.importActual<typeof import("@/lib/presence/store")>("@/lib/presence/store");
    setHereStoreForTests({
      beat: async () => {
        throw new Error("down");
      },
      present: async () => [],
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const svc = await import("@/lib/presence/service");
    expect(await svc.heartbeat("aaaaaaaaaa")).toEqual({ configured: false, count: 0, cells: [] });
  });
});
