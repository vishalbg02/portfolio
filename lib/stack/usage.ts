import { profile } from "@/content/profile";
import type { Experience, Profile, ProjectSlug, SkillGroup } from "@/lib/content/profile-schema";

/**
 * Where was a skill used? Derived from each project's `stack` and each role's `stack` in profile.ts (a role's stack is
 * checked against its own description by a unit test), so it can never contradict the case studies or the résumé.
 * Skill names and stack names differ ("React" vs "React 19", "SQL/MySQL" vs "MySQL"), so matching goes through a small
 * rule table.
 */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+]+/g, "");

/** A web framework or library the browser runs as JavaScript, with HTML and CSS (stack names, normalised). */
const isWebFramework = (s: string) =>
  s.startsWith("react") || s === "nextjs" || s === "threejs" || s === "angularjs";

const RULES: Record<string, (stackItem: string) => boolean> = {
  React: (s) => s.startsWith("react") && !s.startsWith("reactnative"),
  // the languages a listed framework is written in: a React or Next.js app is JavaScript (or TypeScript), HTML and CSS
  JavaScript: (s) => s === "javascript" || s === "typescript" || isWebFramework(s),
  HTML5: (s) => s === "html5" || s === "html" || (isWebFramework(s) && !s.startsWith("reactnative")),
  CSS3: (s) => s === "css3" || s === "css" || s === "tailwindcss",
  Firebase: (s) => s.startsWith("firebase"),
  Firestore: (s) => s.includes("firestore"),
  "Generative AI APIs": (s) => s.includes("generativeai"),
  "SQL/MySQL": (s) => s === "mysql" || s === "sql",
  "Socket programming": (s) => s.startsWith("socket"),
  "Encryption (AES-256)": (s) => s.startsWith("aes"),
};

/** Does one stack entry ("React 19", "Cloud Firestore") count as using this skill from profile.skills? */
export function usesSkill(skill: string, stackItem: string): boolean {
  const rule = RULES[skill] ?? ((s: string) => s === norm(skill));
  return rule(norm(stackItem));
}

export function projectsUsing(skill: string, projects = profile.projects): ProjectSlug[] {
  return projects.filter((p) => p.stack.some((item) => usesSkill(skill, item))).map((p) => p.slug);
}

/* ── roles ─────────────────────────────────────────────────────────────────────────────────────── */

/** A role is shown as its own node unless it IS a project already on the page (Golden Verdict's freelance role). */
const isProject = (e: Experience, p: Pick<Profile, "projects">) =>
  p.projects.some((proj) => proj.name.toLowerCase() === e.short.toLowerCase());

export const roleId = (e: Pick<Experience, "short">) => `role-${norm(e.short)}`;

/** The roles that get their own node on the Stack map ("Cove IoT · internship"). */
export function roleNodes(p: Pick<Profile, "experience" | "projects"> = profile) {
  return p.experience.filter((e) => !isProject(e, p));
}

export function rolesUsing(skill: string, p: Pick<Profile, "experience" | "projects"> = profile): string[] {
  return roleNodes(p)
    .filter((e) => e.stack.some((item) => usesSkill(skill, item)))
    .map(roleId);
}

/* ── where else: a skill no project or role used ──────────────────────────────────────────────── */

export type Elsewhere = {
  kind: "leadership" | "certification" | "site" | "coursework";
  /** Short tag for a skill row ("certificate"). */
  tag: string;
  /** One line for the detail panel. */
  text: string;
};

/** This portfolio itself is the proof of these (its code is public: github.com/vishalbg02/portfolio). */
export const SITE_SKILLS: Record<string, string> = {
  "RAG fundamentals": "GRID, the AI on this site, answers from the site's own content with hybrid retrieval.",
  "Function calling / API integration": "GRID, the AI on this site, calls typed tools to show and do things.",
  Git: "This site's code and its full history are public on GitHub.",
  GitHub: "This site's code and its full history are public on GitHub.",
};

const mentions = (text: string, skill: string) => norm(text).includes(norm(skill));

export function elsewhere(skill: string, p: Profile = profile): Elsewhere {
  const lead = p.leadership.find((l) => mentions(l, skill));
  if (lead) return { kind: "leadership", tag: "leadership", text: lead };
  const site = SITE_SKILLS[skill];
  if (site) return { kind: "site", tag: "this site", text: site };
  const cert = p.certifications.find((c) => mentions(c, skill));
  if (cert) return { kind: "certification", tag: "certificate", text: `Certificate: ${cert}.` };
  return { kind: "coursework", tag: "Coursework & practice", text: `Coursework & practice. ${p.skillsNote}` };
}

/* ── the map ───────────────────────────────────────────────────────────────────────────────────── */

/** A place a skill was used: a project or a role, drawn on the right of the Stack map. */
export type UseNode = {
  id: string;
  kind: "project" | "role";
  name: string;
  /** "project" or "internship · May 2024 – Jul 2024". */
  sub: string;
  href: string;
};

export type StackItem = {
  name: string;
  /** Node ids (project slugs and role ids) that used it. */
  used: string[];
  /** When nothing on the map used it: where it comes from instead. */
  elsewhere: Elsewhere | null;
};
export type StackGroup = { id: string; label: string; items: StackItem[] };

const GROUPS: Array<{ id: string; label: string; key: SkillGroup }> = [
  { id: "backend", label: "Backend", key: "backend" },
  { id: "frontend", label: "Frontend", key: "frontend" },
  { id: "mobile", label: "Mobile", key: "mobile" },
  { id: "data-cloud", label: "Data & Cloud", key: "dataCloud" },
  { id: "ai", label: "AI", key: "ai" },
  { id: "networking", label: "Networking & security", key: "networking" },
  { id: "tools", label: "Tools", key: "tools" },
];

export function buildUseNodes(p: Profile = profile): UseNode[] {
  return [
    ...p.projects.map((proj) => ({
      id: proj.slug,
      kind: "project" as const,
      name: proj.name,
      sub: "project",
      href: `/work/${proj.slug}`,
    })),
    ...roleNodes(p).map((e) => ({
      id: roleId(e),
      kind: "role" as const,
      name: e.short,
      sub: `${e.kind} · ${e.period}`,
      href: "/#experience",
    })),
  ];
}

export function buildStackGroups(p: Profile = profile): StackGroup[] {
  return GROUPS.map(({ id, label, key }) => ({
    id,
    label,
    items: p.skills[key].map((name) => {
      const used = [...projectsUsing(name, p.projects), ...rolesUsing(name, p)];
      return { name, used, elsewhere: used.length ? null : elsewhere(name, p) };
    }),
  }));
}
