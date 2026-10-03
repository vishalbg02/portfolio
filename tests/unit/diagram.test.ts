import { describe, expect, it } from "vitest";
import { graphs } from "@/components/diagram/graphs";
import { edgeEndpoints, easeInOut, flowSegments, progressAt } from "@/components/diagram/geometry";
import { profile } from "@/content/profile";

describe.each(Object.values(graphs))("architecture graph: $slug", (graph) => {
  const ids = new Set(graph.nodes.map((n) => n.id));

  it("has unique node ids and a graph for a real project", () => {
    expect(ids.size).toBe(graph.nodes.length);
    expect(profile.projects.some((p) => p.slug === graph.slug)).toBe(true);
  });

  it("only has edges between existing nodes", () => {
    for (const e of graph.edges) {
      expect(ids.has(e.from), `${e.from} missing`).toBe(true);
      expect(ids.has(e.to), `${e.to} missing`).toBe(true);
    }
  });

  it("every flow walks existing edges", () => {
    const edges = new Set(graph.edges.map((e) => `${e.from}>${e.to}`));
    expect(graph.flows.length).toBeGreaterThan(0);
    for (const flow of graph.flows) {
      expect(flow.path.length).toBeGreaterThan(1);
      for (let i = 0; i < flow.path.length - 1; i++) {
        expect(
          edges.has(`${flow.path[i]}>${flow.path[i + 1]}`),
          `${flow.id}: ${flow.path[i]} → ${flow.path[i + 1]}`,
        ).toBe(true);
      }
    }
  });

  it("every node is reachable by some flow and has a description", () => {
    const used = new Set(graph.flows.flatMap((f) => f.path));
    for (const n of graph.nodes) {
      expect(used.has(n.id), `${n.id} unused`).toBe(true);
      expect(n.description.length).toBeGreaterThan(20);
    }
  });

  it.each(["desktop", "mobile"] as const)(
    "%s layout places every node inside the viewBox without overlap",
    (key) => {
      const layout = graph.layouts[key];
      const { w, h } = layout.node;
      const rects = graph.nodes.map((n) => {
        const p = layout.positions[n.id];
        expect(p, `${n.id} has no position`).toBeDefined();
        return { id: n.id, x0: p!.x - w / 2, x1: p!.x + w / 2, y0: p!.y - h / 2, y1: p!.y + h / 2 };
      });
      for (const r of rects) {
        expect(r.x0).toBeGreaterThanOrEqual(0);
        expect(r.y0).toBeGreaterThanOrEqual(0);
        expect(r.x1).toBeLessThanOrEqual(layout.width);
        expect(r.y1).toBeLessThanOrEqual(layout.height);
      }
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]!;
          const b = rects[j]!;
          const overlap = a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
          expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
        }
      }
    },
  );

  it("no edge passes through a third node", () => {
    for (const key of ["desktop", "mobile"] as const) {
      const layout = graph.layouts[key];
      const { w, h } = layout.node;
      for (const e of graph.edges) {
        const [p0, p1] = edgeEndpoints(layout, e.from, e.to);
        for (const n of graph.nodes) {
          if (n.id === e.from || n.id === e.to) continue;
          const c = layout.positions[n.id]!;
          for (let t = 0.05; t < 1; t += 0.05) {
            const x = p0.x + (p1.x - p0.x) * t;
            const y = p0.y + (p1.y - p0.y) * t;
            const inside = x > c.x - w / 2 && x < c.x + w / 2 && y > c.y - h / 2 && y < c.y + h / 2;
            expect(inside, `${key}: edge ${e.from}→${e.to} crosses ${n.id}`).toBe(false);
          }
        }
      }
    }
  });
});

describe("diagram geometry", () => {
  const layout = graphs["golden-verdict"].layouts.desktop;

  it("clips edges to the node borders", () => {
    const [p0, p1] = edgeEndpoints(layout, "customer", "app");
    const a = layout.positions.customer!;
    const b = layout.positions.app!;
    expect(p0.x).toBeCloseTo(a.x + layout.node.w / 2 + 3, 0);
    expect(p1.x).toBeCloseTo(b.x - layout.node.w / 2 - 3, 0);
    expect(p0.y).toBeCloseTo(a.y, 5);
  });

  it("runs a packet along every segment and finishes", () => {
    const segs = flowSegments(layout, graphs["golden-verdict"].flows[0]!.path);
    expect(segs).toHaveLength(5);
    const start = progressAt(segs, 0);
    expect(start.packet).toEqual(segs[0]!.p0);
    expect(start.nodeIndex).toBe(0);
    const mid = progressAt(segs, 2.5);
    expect(mid.packet!.x).toBeGreaterThan(segs[2]!.p0.x);
    expect(mid.packet!.x).toBeLessThan(segs[2]!.p1.x);
    const end = progressAt(segs, segs.length);
    expect(end.packet).toBeNull();
    expect(end.reached).toBe(segs.length);
  });

  it("marks the next node as reached just before arrival", () => {
    const segs = flowSegments(layout, graphs["golden-verdict"].flows[0]!.path);
    expect(progressAt(segs, 0.5).reached).toBe(0);
    expect(progressAt(segs, 0.95).reached).toBe(1);
  });

  it("eases monotonically from 0 to 1", () => {
    let last = -1;
    for (let u = 0; u <= 1; u += 0.1) {
      const v = easeInOut(u);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
  });
});
