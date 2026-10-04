import type { ContributionDay } from "@/lib/github/types";
import { dayRow } from "@/lib/github/pins";

/**
 * The maths of the 3D Commit City: an orthographic "isometric" view of the contribution calendar as a grid of flat
 * blocks. Pure functions (no DOM, no canvas), so the projection, the painter's order, the face shading and the hit
 * test are unit-tested. World axes: x = week (left to right), y = day of week (Sun to Sat), z = up.
 */
export type Camera = {
  /** Rotation around the vertical axis, radians. π/4 is the classic isometric corner view. */
  yaw: number;
  /** Elevation above the horizon, radians (π/2 would be straight down). */
  pitch: number;
  zoom: number;
  /** Screen-space offset in px (set by dragging with the pan modifier, or by flying to a landmark). */
  panX: number;
  panY: number;
};

/** The year is a long, thin grid (53 weeks by 7 days), so the home view turns it to run mostly across the screen. */
export const HOME: Camera = { yaw: 0.42, pitch: 0.62, zoom: 1, panX: 0, panY: 0 };
export const LIMITS = { pitch: [0.3, 1.2], zoom: [0.6, 3.2] } as const;
export const clamp = (n: number, [lo, hi]: readonly [number, number] | readonly number[]) =>
  Math.min(hi as number, Math.max(lo as number, n));

export type Landmark = { id: string; week: number; day: number; color: string };

export type CityBlock = {
  week: number;
  day: number;
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  /** Height in blocks. */
  z: number;
  /** A tower for an award: the project's colour. */
  landmark: Landmark | null;
};

export const FLOOR = 0.06;
const BASE = 0.3;
const RANGE = 3.8;
/** An award's tower is always taller than any day. */
export const TOWER = 7;

/** A day's height: a hairline tile for nothing, then a square-root scale so one huge day doesn't flatten the rest. */
export function heightFor(count: number, max: number): number {
  if (count <= 0 || max <= 0) return FLOOR;
  return BASE + RANGE * Math.sqrt(Math.min(count, max) / max);
}

export function buildCity(
  weeks: ContributionDay[][],
  landmarks: Landmark[] = [],
): { blocks: CityBlock[]; cols: number; rows: number; max: number } {
  const max = weeks.flat().reduce((m, d) => Math.max(m, d.count), 0);
  const at = new Map(landmarks.map((l) => [`${l.week}:${l.day}`, l]));
  const blocks: CityBlock[] = [];
  weeks.forEach((w, week) =>
    w.forEach((d) => {
      const day = dayRow(d);
      const landmark = at.get(`${week}:${day}`) ?? null;
      blocks.push({
        week,
        day,
        date: d.date,
        count: d.count,
        level: d.level,
        z: landmark ? TOWER : heightFor(d.count, max),
        landmark,
      });
    }),
  );
  return { blocks, cols: weeks.length, rows: 7, max };
}

export type View = { w: number; h: number };
export type Grid = { cols: number; rows: number };
export type P3 = { x: number; y: number; z: number };
export type P2 = { x: number; y: number };

/**
 * World to screen. `scale` is px per block at zoom 1. The depth returned is the rotated y: bigger means nearer the
 * viewer, so blocks are painted in increasing depth.
 */
export function project(p: P3, cam: Camera, view: View, grid: Grid, scale: number): P2 & { depth: number } {
  const x = p.x - grid.cols / 2;
  const y = p.y - grid.rows / 2;
  const c = Math.cos(cam.yaw);
  const s = Math.sin(cam.yaw);
  const rx = x * c - y * s;
  const ry = x * s + y * c;
  const k = scale * cam.zoom;
  return {
    x: view.w / 2 + cam.panX + rx * k,
    y: view.h / 2 + cam.panY + (ry * Math.sin(cam.pitch) - p.z * Math.cos(cam.pitch)) * k,
    depth: ry,
  };
}

/**
 * The scale (px per block at zoom 1) and the starting camera that fit the whole grid, its tallest tower and a margin
 * into a view, centred both ways (the towers rise above the ground, so the box is not centred on the grid's middle).
 */
export function fitCamera(view: View, grid: Grid, margin = 28): { scale: number; home: Camera } {
  const probe = { ...HOME, zoom: 1, panX: 0, panY: 0 };
  const corners: P3[] = [];
  for (const x of [0, grid.cols])
    for (const y of [0, grid.rows]) for (const z of [0, TOWER]) corners.push({ x, y, z });
  const pts = corners.map((p) => project(p, probe, { w: 0, h: 0 }, grid, 1));
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const scale = Math.max(
    1,
    Math.min((view.w - margin * 2) / (maxX - minX), (view.h - margin * 2) / (maxY - minY)),
  );
  return { scale, home: { ...HOME, panX: -((minX + maxX) / 2) * scale, panY: -((minY + maxY) / 2) * scale } };
}

/** Just the scale of `fitCamera`. */
export const fitScale = (view: View, grid: Grid, margin = 28) => fitCamera(view, grid, margin).scale;

export type FaceTone = "left" | "right" | "front";
export type Face = { axis: "x" | "y"; sign: 1 | -1; tone: FaceTone };

/**
 * Which two vertical faces of a block face the viewer at this yaw, and how they are lit. A face is visible when its
 * outward normal points toward the viewer (rotated y component > 0); of two visible faces the one on the left of the
 * screen gets the lighter tone. Seen exactly along an axis only one face shows, lit as the "front".
 */
export function facesFor(yaw: number): Face[] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const all: Array<Face & { ry: number; rx: number }> = [
    { axis: "x", sign: 1, tone: "front", ry: s, rx: c },
    { axis: "x", sign: -1, tone: "front", ry: -s, rx: -c },
    { axis: "y", sign: 1, tone: "front", ry: c, rx: -s },
    { axis: "y", sign: -1, tone: "front", ry: -c, rx: s },
  ];
  const seen = all.filter((f) => f.ry > 1e-6).sort((a, b) => a.rx - b.rx);
  return seen.map((f, i) => ({
    axis: f.axis,
    sign: f.sign,
    tone: seen.length === 1 ? "front" : i === 0 ? "left" : "right",
  }));
}

/** Block indices from the farthest to the nearest: the order to paint them in. */
export function paintOrder(
  blocks: Array<Pick<CityBlock, "week" | "day">>,
  cam: Camera,
  grid: Grid,
): number[] {
  const c = Math.cos(cam.yaw);
  const s = Math.sin(cam.yaw);
  const depth = (b: Pick<CityBlock, "week" | "day">) =>
    (b.week + 0.5 - grid.cols / 2) * s + (b.day + 0.5 - grid.rows / 2) * c;
  return blocks
    .map((b, i) => ({ i, d: depth(b), b }))
    .sort((a, b) => a.d - b.d || a.b.week - b.b.week || a.b.day - b.b.day)
    .map((x) => x.i);
}

/** The corner points (screen space) of a box's top and of each visible side. */
export function boxPolys(
  box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number },
  cam: Camera,
  view: View,
  grid: Grid,
  scale: number,
): { top: P2[]; sides: Array<{ face: Face; pts: P2[] }> } {
  const pr = (x: number, y: number, z: number) => project({ x, y, z }, cam, view, grid, scale);
  const { x0, x1, y0, y1, z0, z1 } = box;
  const top = [pr(x0, y0, z1), pr(x1, y0, z1), pr(x1, y1, z1), pr(x0, y1, z1)];
  const sides = facesFor(cam.yaw).map((face) => {
    const fixed = face.axis === "x" ? (face.sign === 1 ? x1 : x0) : face.sign === 1 ? y1 : y0;
    const [a, c] = face.axis === "x" ? [y0, y1] : [x0, x1];
    const at = (t: number, z: number) => (face.axis === "x" ? pr(fixed, t, z) : pr(t, fixed, z));
    return { face, pts: [at(a, z1), at(c, z1), at(c, z0), at(a, z0)] };
  });
  return { top, sides };
}

/** The corner points (screen space) of a day's block: a unit square from the ground up to its height. */
export function blockPolys(
  b: Pick<CityBlock, "week" | "day" | "z">,
  cam: Camera,
  view: View,
  grid: Grid,
  scale: number,
): { top: P2[]; sides: Array<{ face: Face; pts: P2[] }> } {
  return boxPolys(
    { x0: b.week, x1: b.week + 1, y0: b.day, y1: b.day + 1, z0: 0, z1: b.z },
    cam,
    view,
    grid,
    scale,
  );
}

/** A hex colour times a brightness factor (0 to 1): a flat shade for a side face. */
export function shade(hex: string, factor: number): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const ch = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * factor)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}
export const TONE: Record<FaceTone, number> = { left: 0.72, right: 0.5, front: 0.6 };

/** Even-odd point-in-polygon test, for finding the block under the pointer. */
export function pointInPolygon(poly: P2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** The nearest block under a screen point (the last painted wins), or null. */
export function hitTest(
  blocks: CityBlock[],
  order: number[],
  cam: Camera,
  view: View,
  grid: Grid,
  scale: number,
  x: number,
  y: number,
): CityBlock | null {
  for (let k = order.length - 1; k >= 0; k--) {
    const b = blocks[order[k]!]!;
    const { top, sides } = blockPolys(b, cam, view, grid, scale);
    if (pointInPolygon(top, x, y) || sides.some((s) => pointInPolygon(s.pts, x, y))) return b;
  }
  return null;
}

/** The camera that centres a world point at a zoom: where "fly to this landmark" ends up. */
export function centreOn(p: P3, cam: Camera, view: View, grid: Grid, scale: number, zoom: number): Camera {
  const probe = project(p, { ...cam, zoom, panX: 0, panY: 0 }, view, grid, scale);
  return { ...cam, zoom, panX: view.w / 2 - probe.x, panY: view.h * 0.42 - probe.y };
}

export const ease = (t: number) => 1 - (1 - t) ** 3;

/** One step of a camera flight from `a` to `b`, t in [0, 1]. The yaw takes the short way round. */
export function lerpCamera(a: Camera, b: Camera, t: number): Camera {
  const k = ease(Math.min(1, Math.max(0, t)));
  const dyaw = ((((b.yaw - a.yaw) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  const mix = (x: number, y: number) => x + (y - x) * k;
  return {
    yaw: a.yaw + dyaw * k,
    pitch: mix(a.pitch, b.pitch),
    zoom: mix(a.zoom, b.zoom),
    panX: mix(a.panX, b.panX),
    panY: mix(a.panY, b.panY),
  };
}

/**
 * Labels along a row, left to right, each `width` wide at x: the tier (0 = nearest) each takes so none overlap,
 * lowest free tier first. Same idea as the 2D calendar's pin labels.
 */
export function stagger(items: Array<{ x: number; width: number }>, gap = 8): number[] {
  const order = items.map((it, i) => ({ ...it, i })).sort((a, b) => a.x - b.x || a.i - b.i);
  const ends: number[] = [];
  const tiers = new Array<number>(items.length).fill(0);
  for (const it of order) {
    let t = ends.findIndex((end) => end + gap <= it.x);
    if (t < 0) t = ends.length;
    ends[t] = it.x + it.width;
    tiers[it.i] = t;
  }
  return tiers;
}
