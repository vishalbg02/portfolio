import { profile } from "@/content/profile";
import type { ProjectSlug } from "@/lib/content/profile-schema";

/**
 * Which projects used a skill? Derived from each project's `stack` in profile.ts, so it can never
 * contradict the case studies. Skill names and stack names differ ("React" vs "React 19",
 * "Firestore" vs "Cloud Firestore"), so matching goes through a small rule table.
 */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

const RULES: Record<string, (stackItem: string) => boolean> = {
  React: (s) => s.startsWith("react") && !s.startsWith("reactnative"),
  Firebase: (s) => s.startsWith("firebase"),
  Firestore: (s) => s.includes("firestore"),
  "Generative AI APIs": (s) => s.includes("generativeai"),
};

export function projectsUsing(skill: string, projects = profile.projects): ProjectSlug[] {
  const rule = RULES[skill] ?? ((s: string) => s === norm(skill));
  return projects.filter((p) => p.stack.some((item) => rule(norm(item)))).map((p) => p.slug);
}

export type StackItem = { name: string; projects: ProjectSlug[] };
export type StackGroup = { id: string; label: string; items: StackItem[] };

const GROUPS: Array<{ id: string; label: string; key: keyof typeof profile.skills }> = [
  { id: "backend", label: "Backend", key: "backend" },
  { id: "frontend", label: "Frontend", key: "frontend" },
  { id: "mobile", label: "Mobile", key: "mobile" },
  { id: "data-cloud", label: "Data & Cloud", key: "dataCloud" },
  { id: "ai", label: "AI", key: "ai" },
  { id: "tools", label: "Tools", key: "tools" },
];

export function buildStackGroups(): StackGroup[] {
  return GROUPS.map(({ id, label, key }) => ({
    id,
    label,
    items: profile.skills[key].map((name) => ({ name, projects: projectsUsing(name) })),
  }));
}
