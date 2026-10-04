import { profile } from "@/content/profile";
import { shipped } from "@/lib/site";

/**
 * Where GRID's `navigate` tool may send a visitor. A fixed allow-list (never a URL from the model), shared by
 * the server (which validates and describes) and the client (which scrolls or routes).
 */
type Target = { href: string; label: string };

const fixed: Record<string, Target> = {
  home: { href: "/", label: "Home" },
  work: { href: "/#work", label: "Selected work" },
  experience: { href: "/#experience", label: "Experience" },
  stack: { href: "/#stack", label: "Stack" },
  activity: { href: "/#github", label: "GitHub activity" },
  ask: { href: "/#ask", label: "Ask GRID" },
  contact: { href: "/#contact", label: "Contact" },
  resume: { href: "/resume", label: "Résumé" },
  recruiter: { href: "/recruiter", label: "Recruiter mode" },
  now: { href: "/now", label: "Now" },
  privacy: { href: "/privacy", label: "Privacy" },
  ...(shipped.log ? { log: { href: "/log", label: "Ship Log" } } : {}),
};

const projects: Record<string, Target> = Object.fromEntries(
  profile.projects.map((p) => [p.slug, { href: `/work/${p.slug}`, label: `${p.name} case study` }]),
);

export const NAV_TARGETS: Record<string, Target> = { ...fixed, ...projects };
export const NAV_TARGET_IDS = Object.keys(NAV_TARGETS) as [string, ...string[]];

export const resolveTarget = (id: string): Target | null => NAV_TARGETS[id] ?? null;
