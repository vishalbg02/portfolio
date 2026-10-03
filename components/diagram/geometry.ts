import type { GraphLayout, Point } from "./types";

const GAP = 3;

/** Point where the segment from `from` toward `to` leaves a w×h rect centered on `from`. */
function exitPoint(from: Point, to: Point, w: number, h: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const tx = dx === 0 ? Infinity : w / 2 / Math.abs(dx);
  const ty = dy === 0 ? Infinity : h / 2 / Math.abs(dy);
  const t = Math.min(tx, ty);
  const len = Math.hypot(dx, dy);
  // Step slightly past the border so arrowheads don't touch the node stroke.
  const extra = GAP / len;
  return { x: from.x + dx * (t + extra), y: from.y + dy * (t + extra) };
}

/** Border-to-border endpoints of an edge in a layout. */
export function edgeEndpoints(layout: GraphLayout, fromId: string, toId: string): [Point, Point] {
  const a = layout.positions[fromId];
  const b = layout.positions[toId];
  if (!a || !b) throw new Error(`Unknown node in edge ${fromId} → ${toId}`);
  return [exitPoint(a, b, layout.node.w, layout.node.h), exitPoint(b, a, layout.node.w, layout.node.h)];
}

export type Segment = { from: string; to: string; p0: Point; p1: Point };

export function flowSegments(layout: GraphLayout, path: string[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [p0, p1] = edgeEndpoints(layout, path[i]!, path[i + 1]!);
    segments.push({ from: path[i]!, to: path[i + 1]!, p0, p1 });
  }
  return segments;
}

export const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export const lerp = (a: Point, b: Point, u: number): Point => ({
  x: a.x + (b.x - a.x) * u,
  y: a.y + (b.y - a.y) * u,
});

export type FlowProgress = {
  /** Packet position, null once finished. */
  packet: Point | null;
  /** Index into `path` of the node the request is currently at/arriving at. */
  nodeIndex: number;
  /** Indices of nodes already reached. */
  reached: number;
};

/** Where the request is after `progress` ∈ [0, segments.length] segment-lengths. */
export function progressAt(segments: Segment[], progress: number): FlowProgress {
  const n = segments.length;
  if (n === 0) return { packet: null, nodeIndex: 0, reached: 0 };
  if (progress >= n) return { packet: null, nodeIndex: n, reached: n };
  const i = Math.max(0, Math.min(n - 1, Math.floor(progress)));
  const u = progress - i;
  const seg = segments[i]!;
  return {
    packet: lerp(seg.p0, seg.p1, easeInOut(u)),
    nodeIndex: u > 0.9 ? i + 1 : i,
    reached: u > 0.9 ? i + 1 : i,
  };
}
