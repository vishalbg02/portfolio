import type { StackGroup } from "./usage";

/** A node is a project slug or a role id (see buildUseNodes). */
export type Active = { skill: string | null; node: string | null };

/**
 * Which skill chips and "used in" nodes (projects and roles) are lit, and which skill→node connections to draw.
 * A skill lights the nodes that used it; a node lights every skill it used. If both are active (a skill is
 * hovered while a node is pinned) the skill wins, so the picture never shows a half-and-half state.
 */
export function connections(groups: StackGroup[], active: Active) {
  const items = groups.flatMap((g) => g.items);
  if (active.skill) {
    const item = items.find((i) => i.name === active.skill);
    const nodes = item?.used ?? [];
    return {
      skills: item && nodes.length ? [item.name] : [],
      nodes,
      pairs: nodes.map((n) => [item!.name, n] as const),
    };
  }
  if (active.node) {
    const skills = items.filter((i) => i.used.includes(active.node!)).map((i) => i.name);
    return { skills, nodes: [active.node], pairs: skills.map((s) => [s, active.node!] as const) };
  }
  return {
    skills: [] as string[],
    nodes: [] as string[],
    pairs: [] as Array<readonly [string, string]>,
  };
}
