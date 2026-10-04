import { describe, expect, it } from "vitest";
import {
  FLOOR,
  HOME,
  TOWER,
  blockPolys,
  buildCity,
  centreOn,
  facesFor,
  fitCamera,
  fitScale,
  heightFor,
  hitTest,
  lerpCamera,
  paintOrder,
  pointInPolygon,
  project,
  shade,
  stagger,
  type Camera,
} from "@/lib/city/iso";
import type { ContributionDay } from "@/lib/github/types";

const view = { w: 800, h: 400 };
const grid = { cols: 53, rows: 7 };
const cam = (over: Partial<Camera> = {}): Camera => ({ ...HOME, ...over });

/** A tiny calendar: `n` Sunday-start weeks of seven days from 2026-01-04 (a Sunday). */
const calendar = (n: number, count = (w: number, d: number) => (w + d) % 5): ContributionDay[][] =>
  Array.from({ length: n }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(Date.UTC(2026, 0, 4 + w * 7 + d)).toISOString().slice(0, 10);
      const c = count(w, d);
      return {
        date,
        count: c,
        level: (c === 0 ? 0 : Math.min(4, 1 + Math.floor(c / 2))) as 0 | 1 | 2 | 3 | 4,
      };
    }),
  );

describe("heights", () => {
  it("a day with nothing is a hairline tile; busier days are taller; the busiest tops the scale", () => {
    expect(heightFor(0, 30)).toBe(FLOOR);
    expect(heightFor(1, 30)).toBeGreaterThan(FLOOR);
    expect(heightFor(5, 30)).toBeLessThan(heightFor(20, 30));
    expect(heightFor(30, 30)).toBeCloseTo(4.1, 5);
    expect(heightFor(99, 30)).toBe(heightFor(30, 30)); // capped
  });

  it("uses a square-root scale, so one huge day does not flatten the rest", () => {
    expect(heightFor(1, 100)).toBeGreaterThan(0.3 + 3.8 * 0.05); // well above a linear 1 %
  });

  it("an award's tower is taller than any day", () => {
    expect(TOWER).toBeGreaterThan(heightFor(1e9, 1e9));
  });
});

describe("buildCity", () => {
  it("makes one block per day with its week, row, count, level and height, and puts landmarks on their cells", () => {
    const weeks = calendar(4);
    const lm = { id: "award-x", week: 2, day: 3, color: "#58a6ff" };
    const city = buildCity(weeks, [lm]);
    expect(city.blocks).toHaveLength(28);
    expect(city.cols).toBe(4);
    expect(city.rows).toBe(7);
    expect(city.max).toBe(4);
    const tower = city.blocks.find((b) => b.landmark)!;
    expect([tower.week, tower.day, tower.z]).toEqual([2, 3, TOWER]);
    expect(city.blocks.filter((b) => b.landmark)).toHaveLength(1);
    expect(city.blocks.find((b) => b.week === 0 && b.day === 0)!.z).toBe(FLOOR); // count 0
  });

  it("handles a quiet calendar (no contributions) without dividing by zero", () => {
    const city = buildCity(calendar(2, () => 0));
    expect(city.max).toBe(0);
    expect(city.blocks.every((b) => b.z === FLOOR)).toBe(true);
  });
});

describe("projection", () => {
  it("seen from straight above, height does not move a point; seen from the side, depth does not", () => {
    const top = cam({ pitch: Math.PI / 2, yaw: 0 });
    const a = project({ x: 10, y: 3, z: 0 }, top, view, grid, 10);
    const b = project({ x: 10, y: 3, z: 6 }, top, view, grid, 10);
    expect(b.y).toBeCloseTo(a.y, 6);
    const side = cam({ pitch: 0, yaw: 0 });
    const c = project({ x: 10, y: 0, z: 2 }, side, view, grid, 10);
    const d = project({ x: 10, y: 6, z: 2 }, side, view, grid, 10);
    expect(d.y).toBeCloseTo(c.y, 6);
  });

  it("taller means higher on the screen, nearer means lower", () => {
    const c = cam();
    const base = project({ x: 20, y: 3, z: 0 }, c, view, grid, 10);
    expect(project({ x: 20, y: 3, z: 4 }, c, view, grid, 10).y).toBeLessThan(base.y);
    // increasing x and y both move toward the viewer
    expect(project({ x: 21, y: 4, z: 0 }, c, view, grid, 10).depth).toBeGreaterThan(base.depth);
  });

  it("rotating a quarter turn swaps the axes; zoom scales about the centre; pan shifts", () => {
    const p = { x: 30, y: 3.5, z: 0 };
    const flat = (yaw: number) => project(p, cam({ yaw, pitch: Math.PI / 2 }), view, grid, 10);
    const q0 = flat(0);
    const q1 = flat(Math.PI / 2);
    expect(q0.x - view.w / 2).toBeCloseTo((30 - 26.5) * 10, 6);
    expect(q1.x - view.w / 2).toBeCloseTo(0, 6);
    expect(q1.y - view.h / 2).toBeCloseTo((30 - 26.5) * 10, 6);
    const z2 = project(p, cam({ yaw: 0, pitch: Math.PI / 2, zoom: 2 }), view, grid, 10);
    expect(z2.x - view.w / 2).toBeCloseTo(2 * (q0.x - view.w / 2), 6);
    const moved = project(p, cam({ yaw: 0, pitch: Math.PI / 2, panX: 25, panY: -10 }), view, grid, 10);
    expect([moved.x - q0.x, moved.y - q0.y]).toEqual([25, -10]);
  });

  it("fitCamera fits the whole grid and its tallest tower inside the view, centred, with a margin", () => {
    for (const v of [
      { w: 390, h: 340 },
      { w: 1200, h: 460 },
    ]) {
      const { scale, home } = fitCamera(v, grid, 28);
      const pts = [];
      for (const x of [0, grid.cols])
        for (const y of [0, grid.rows])
          for (const z of [0, TOWER]) pts.push(project({ x, y, z }, home, v, grid, scale));
      expect(Math.min(...pts.map((p) => p.x))).toBeGreaterThanOrEqual(27.5);
      expect(Math.max(...pts.map((p) => p.x))).toBeLessThanOrEqual(v.w - 27.5);
      expect(Math.min(...pts.map((p) => p.y))).toBeGreaterThanOrEqual(27.5);
      expect(Math.max(...pts.map((p) => p.y))).toBeLessThanOrEqual(v.h - 27.5);
      // centred: the margins on opposite sides match
      const left = Math.min(...pts.map((p) => p.x));
      const right = v.w - Math.max(...pts.map((p) => p.x));
      expect(left).toBeCloseTo(right, 5);
      const topGap = Math.min(...pts.map((p) => p.y));
      const bottomGap = v.h - Math.max(...pts.map((p) => p.y));
      expect(topGap).toBeCloseTo(bottomGap, 5);
    }
    expect(fitScale({ w: 1200, h: 800 }, grid)).toBeGreaterThan(fitScale({ w: 600, h: 400 }, grid));
  });
});

describe("faces and painting", () => {
  it("at the corner view two faces show, the left one lighter; along an axis one face shows, as the front", () => {
    const corner = facesFor(Math.PI / 4);
    expect(corner.map((f) => `${f.axis}${f.sign > 0 ? "+" : "-"}:${f.tone}`)).toEqual([
      "y+:left",
      "x+:right",
    ]);
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const f = facesFor(yaw);
      expect(f, `yaw ${yaw}`).toHaveLength(1);
      expect(f[0]!.tone).toBe("front");
    }
    for (let a = 0.05; a < 2 * Math.PI; a += 0.31) {
      const f = facesFor(a);
      expect(f.length).toBeGreaterThanOrEqual(1);
      expect(f.length).toBeLessThanOrEqual(2);
      if (f.length === 2) expect(new Set(f.map((x) => x.tone))).toEqual(new Set(["left", "right"]));
    }
  });

  it("paints far to near at any rotation: depth never decreases along the order", () => {
    const { blocks } = buildCity(calendar(12));
    for (let yaw = -3; yaw <= 3; yaw += 0.37) {
      const c = cam({ yaw });
      const order = paintOrder(blocks, c, { cols: 12, rows: 7 });
      expect(order).toHaveLength(blocks.length);
      expect(new Set(order).size).toBe(blocks.length);
      const depths = order.map(
        (i) =>
          project(
            { x: blocks[i]!.week + 0.5, y: blocks[i]!.day + 0.5, z: 0 },
            c,
            view,
            { cols: 12, rows: 7 },
            10,
          ).depth,
      );
      for (let k = 1; k < depths.length; k++)
        expect(depths[k]!).toBeGreaterThanOrEqual(depths[k - 1]! - 1e-9);
    }
  });

  it("a block's top is a quad and each visible side hangs below it on the screen", () => {
    const g = { cols: 12, rows: 7 };
    const polys = blockPolys({ week: 4, day: 2, z: 3 }, cam(), view, g, 12);
    expect(polys.top).toHaveLength(4);
    expect(polys.sides).toHaveLength(2);
    for (const s of polys.sides) {
      expect(s.pts).toHaveLength(4);
      // the bottom edge (points 2 and 3) is lower on the screen than the top edge (0 and 1)
      expect(s.pts[2]!.y).toBeGreaterThan(s.pts[0]!.y);
      expect(s.pts[3]!.y).toBeGreaterThan(s.pts[1]!.y);
    }
  });
});

describe("picking", () => {
  const g = { cols: 12, rows: 7 };
  it("finds the block under a point, and null over empty space", () => {
    const { blocks } = buildCity(calendar(12), []);
    const c = cam();
    const order = paintOrder(blocks, c, g);
    const target = blocks.find((b) => b.week === 6 && b.day === 3)!;
    const { top } = blockPolys(target, c, view, g, 14);
    const cx = top.reduce((s, p) => s + p.x, 0) / 4;
    const cy = top.reduce((s, p) => s + p.y, 0) / 4;
    const hit = hitTest(blocks, order, c, view, g, 14, cx, cy)!;
    expect([hit.week, hit.day]).toEqual([6, 3]);
    expect(hitTest(blocks, order, c, view, g, 14, 2, 2)).toBeNull();
  });

  it("a tall block in front hides the one behind it", () => {
    const blocks = buildCity(
      calendar(3, () => 0),
      [{ id: "t", week: 1, day: 1, color: "#fff" }],
    ).blocks;
    const gg = { cols: 3, rows: 7 };
    const c = cam({ yaw: Math.PI / 4 }); // at the corner view the tower at (1, 1) stands exactly in front of (0, 0)
    const order = paintOrder(blocks, c, gg);
    const behind = blocks.find((b) => b.week === 0 && b.day === 0)!;
    const { top } = blockPolys(behind, c, view, gg, 30);
    const cx = top.reduce((s, p) => s + p.x, 0) / 4;
    const cy = top.reduce((s, p) => s + p.y, 0) / 4;
    const hit = hitTest(blocks, order, c, view, gg, 30, cx, cy)!;
    expect(hit.landmark?.id).toBe("t");
  });

  it("pointInPolygon works for a square and a triangle", () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(pointInPolygon(sq, 2, 2)).toBe(true);
    expect(pointInPolygon(sq, 5, 2)).toBe(false);
    const tri = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 0, y: 6 },
    ];
    expect(pointInPolygon(tri, 1, 1)).toBe(true);
    expect(pointInPolygon(tri, 5, 5)).toBe(false);
  });
});

describe("flying the camera", () => {
  it("centreOn puts the point where the card leaves room for it", () => {
    const p = { x: 20.5, y: 3.5, z: 7 };
    const end = centreOn(p, cam(), view, grid, 12, 2);
    expect(end.zoom).toBe(2);
    const at = project(p, end, view, grid, 12);
    expect(at.x).toBeCloseTo(view.w / 2, 6);
    expect(at.y).toBeCloseTo(view.h * 0.42, 6);
  });

  it("lerpCamera starts and ends where asked and turns the short way round", () => {
    const a = cam({ yaw: (350 * Math.PI) / 180, zoom: 1 });
    const b = cam({ yaw: (10 * Math.PI) / 180, zoom: 2, panX: 40 });
    expect(lerpCamera(a, b, 0)).toEqual(a);
    const end = lerpCamera(a, b, 1);
    expect(end.zoom).toBe(2);
    expect(end.panX).toBe(40);
    expect(Math.cos(end.yaw)).toBeCloseTo(Math.cos(b.yaw), 9);
    expect(Math.sin(end.yaw)).toBeCloseTo(Math.sin(b.yaw), 9);
    const mid = lerpCamera(a, b, 0.5).yaw; // 350° → 10° passes through 0°, not 180°
    expect(Math.cos(mid)).toBeGreaterThan(0.9);
    expect(lerpCamera(a, b, 7).zoom).toBe(2); // t is clamped
  });
});

describe("shade and stagger", () => {
  it("shade multiplies the channels, clamps, and keeps a hex colour", () => {
    expect(shade("#26a641", 1)).toBe("#26a641");
    expect(shade("#26a641", 0.5)).toBe("#135321");
    expect(shade("#ffffff", 0)).toBe("#000000");
    expect(shade("#808080", 3)).toBe("#ffffff");
    expect(shade("#39d353", 0.72)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("stagger gives overlapping labels different tiers and reuses a tier once it is free", () => {
    const tiers = stagger([
      { x: 0, width: 100 },
      { x: 50, width: 100 },
      { x: 120, width: 60 },
      { x: 400, width: 80 },
    ]);
    expect(tiers).toEqual([0, 1, 0, 0]);
    expect(stagger([])).toEqual([]);
    // however they are listed, no two labels on one tier overlap
    const items = [
      { x: 300, width: 90 },
      { x: 10, width: 200 },
      { x: 150, width: 90 },
      { x: 160, width: 30 },
    ];
    const t = stagger(items, 8);
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++)
        if (t[i] === t[j]) {
          const [a, b] = items[i]!.x < items[j]!.x ? [items[i]!, items[j]!] : [items[j]!, items[i]!];
          expect(a.x + a.width + 8).toBeLessThanOrEqual(b.x);
        }
  });
});
