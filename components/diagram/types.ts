import type { ProjectSlug } from "@/lib/content/profile-schema";

export type NodeKind = "actor" | "service" | "store" | "external";

export type GraphNode = {
  id: string;
  label: string;
  /** Short mono caption under the label. */
  sub?: string;
  kind: NodeKind;
  /** What this node does — shown in the tooltip and in the text-only description. */
  description: string;
};

export type GraphEdge = { from: string; to: string };

/** A request walking through the graph: every consecutive pair must be an edge. */
export type Flow = { id: string; label: string; path: string[] };

export type Point = { x: number; y: number };

/** Hand-placed layout (node centers) in SVG user units. */
export type GraphLayout = {
  width: number;
  height: number;
  node: { w: number; h: number };
  positions: Record<string, Point>;
};

export type ArchitectureGraph = {
  slug: ProjectSlug;
  /** Used in the accessible name of the diagram. */
  title: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  flows: Flow[];
  layouts: { desktop: GraphLayout; mobile: GraphLayout };
};
