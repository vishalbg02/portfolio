import type { ProjectSlug } from "@/lib/content/profile-schema";
import type { StackGroup } from "./usage";

export type Active = { skill: string | null; project: ProjectSlug | null };

/**
 * Which skill chips and project markers are lit, and which skill→project connections to draw.
 * A skill lights the projects that used it; a project lights every skill it used. If both are
 * active (a skill is hovered while a project is pinned) the skill wins, so the picture never
 * shows a half-and-half state.
 */
export function connections(groups: StackGroup[], active: Active) {
  const items = groups.flatMap((g) => g.items);
  if (active.skill) {
    const item = items.find((i) => i.name === active.skill);
    const projects = item?.projects ?? [];
    return {
      skills: item && projects.length ? [item.name] : [],
      projects,
      pairs: projects.map((p) => [item!.name, p] as const),
    };
  }
  if (active.project) {
    const skills = items.filter((i) => i.projects.includes(active.project!)).map((i) => i.name);
    return { skills, projects: [active.project], pairs: skills.map((s) => [s, active.project!] as const) };
  }
  return {
    skills: [] as string[],
    projects: [] as ProjectSlug[],
    pairs: [] as Array<readonly [string, ProjectSlug]>,
  };
}
