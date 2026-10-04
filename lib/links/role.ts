import { profile } from "@/content/profile";
import type { ProjectSlug } from "@/lib/content/profile-schema";
import { projectsUsing } from "@/lib/stack/usage";

/**
 * What matters for a role, worked out with plain rules from the profile (no model): the role's words map to skill names,
 * only skills Vishal actually lists are kept, and projects are ranked by how many of those skills they used. A company
 * link uses this to say what is most relevant for the role it was made for, and to light the matching projects.
 */
const ALL_SKILLS = Object.values(profile.skills).flat();
const has = (names: string[]) => names.filter((n) => ALL_SKILLS.includes(n));

const RULES: Array<{ re: RegExp; skills: string[] }> = [
  {
    re: /\b(back-?end|server|java|spring|api|microservice)/i,
    skills: [
      "Java",
      "Spring Boot",
      "Spring Security",
      "Spring Data JPA",
      "REST APIs",
      "Microservices",
      "SQL/MySQL",
      "Node.js",
    ],
  },
  {
    re: /\b(front-?end|react|next|ui|web|javascript|css)/i,
    skills: ["React", "Next.js", "JavaScript", "HTML5", "CSS3", "Tailwind CSS", "Three.js"],
  },
  {
    re: /\b(mobile|android|flutter|kotlin|app)/i,
    skills: ["Flutter", "Dart", "Kotlin", "Android", "React Native"],
  },
  { re: /\b(data|sql|database|dba)/i, skills: ["SQL/MySQL", "MySQL", "MongoDB", "Firestore", "Firebase"] },
  {
    re: /\b(ai|ml|llm|rag|gen-?ai|machine)/i,
    skills: ["Generative AI APIs", "RAG fundamentals", "Function calling / API integration"],
  },
  { re: /\b(devops|cloud|aws|sre|platform)/i, skills: ["AWS", "Vercel", "Git", "GitHub"] },
];

export type RoleRank = {
  /** The role as typed, or the profile's own target role when the link has none. */
  label: string;
  skills: string[];
  projects: Array<{ slug: ProjectSlug; name: string; skills: string[] }>;
};

export function rankForRole(role: string | null): RoleRank {
  const text = (role ?? "").trim();
  const matched = new Set<string>();
  for (const r of RULES) if (r.re.test(text)) for (const s of has(r.skills)) matched.add(s);
  // "SDE", "Software Engineer", "Full Stack", or a role with no word it knows: his own core skills, and the skills his
  // projects lean on most (the ones several of them used), so the list is never empty and never invented
  const generic = /\b(sde|software engineer|full-?\s?stack)\b/i.test(text);
  if (matched.size === 0 || generic) {
    for (const s of has(profile.targetRole.coreSkills.flatMap((c) => c.split(/\s*\/\s*/)))) matched.add(s);
    const byUse = ALL_SKILLS.map((s) => ({ s, n: projectsUsing(s).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || ALL_SKILLS.indexOf(a.s) - ALL_SKILLS.indexOf(b.s));
    for (const { s } of byUse.slice(0, 8)) matched.add(s);
  }
  const skills = [...matched];
  const projects = profile.projects
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      skills: skills.filter((s) => projectsUsing(s).includes(p.slug)),
    }))
    .filter((p) => p.skills.length > 0)
    .sort((a, b) => b.skills.length - a.skills.length || a.name.localeCompare(b.name))
    .slice(0, 3);
  return { label: text || profile.targetRole.title, skills, projects };
}
