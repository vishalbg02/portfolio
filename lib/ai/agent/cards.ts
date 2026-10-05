import { mediaById } from "@/content/media";
import { TOUR } from "@/content/tour";
import { profile, projectBySlug } from "@/content/profile";
import { sceneFor } from "@/content/scenes";
import { graphs } from "@/components/diagram/graphs";
import { kindOf } from "@/lib/content/kind";
import { LIGHTHOUSE_FILE, readLighthouse, displayScore } from "@/lib/lighthouse";
import { resolveTarget } from "@/lib/grid/targets";
import { clipSources, stillSources } from "@/lib/media/paths";
import { elsewhere, projectsUsing, roleId, roleNodes, usesSkill } from "@/lib/stack/usage";
import { site } from "@/lib/site";
import type { ContactAction, ProjectImage, UiPart } from "../protocol";

/**
 * Builders for GRID's cards. Every field comes from content/*.ts (or CI-written files like the Lighthouse
 * scores), never from the model: the model only picks which card and for which slug or skill.
 */

export function projectImage(slug: string): ProjectImage | null {
  const hero = sceneFor(slug)?.hero;
  if (!hero || hero.type === "illustration") return null;
  const asset = mediaById(hero.id);
  if (!asset) return null;
  const s = asset.kind === "still" ? stillSources(asset) : clipSources(asset).poster;
  return {
    avifSet: s.avifSet,
    webpSet: s.webpSet,
    src: s.fallback,
    width: s.width,
    height: s.height,
    alt: asset.alt,
    frame: asset.frame,
  };
}

export function projectCard(slug: string): UiPart | null {
  const p = projectBySlug(slug);
  if (!p) return null;
  const links: Array<{ label: string; href: string; external: boolean }> = [
    { label: "Case study", href: `/work/${p.slug}`, external: false },
  ];
  if (p.live) links.push({ label: "Live", href: p.live, external: true });
  if (p.store) links.push({ label: "Google Play", href: p.store, external: true });
  if (p.repo) links.push({ label: "Code", href: p.repo, external: true });
  return {
    kind: "project",
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    summary: p.summary,
    eyebrow: [kindOf(p.type), p.period].filter(Boolean).join(" · "),
    stack: p.stack,
    links,
    badge: p.badge,
    live: Boolean(p.live),
    image: projectImage(p.slug),
  };
}

export type ContactKind = "all" | "email" | "phone" | "whatsapp" | "linkedin" | "github";

export function contactCard(kind: ContactKind = "all"): UiPart {
  const c = profile.contact;
  const all: Array<{
    id: Exclude<ContactKind, "all">;
    label: string;
    value: string;
    actions: ContactAction[];
  }> = [
    {
      id: "email",
      label: "Email",
      value: c.email,
      actions: [
        { type: "copy", label: "Copy", text: c.email },
        { type: "open", label: "Write", href: `mailto:${c.email}` },
      ],
    },
    {
      id: "phone",
      label: "Phone",
      value: c.phone,
      actions: [
        { type: "copy", label: "Copy", text: c.phone },
        { type: "call", label: "Call", href: c.phoneHref },
      ],
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      value: c.phone,
      actions: [{ type: "open", label: "Open", href: c.whatsapp }],
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      value: c.linkedin.replace(/^https?:\/\//, ""),
      actions: [{ type: "open", label: "Open", href: c.linkedin }],
    },
    {
      id: "github",
      label: "GitHub",
      value: c.github.replace(/^https?:\/\//, ""),
      actions: [{ type: "open", label: "Open", href: c.github }],
    },
  ];
  return { kind: "contact", items: kind === "all" ? all : all.filter((i) => i.id === kind) };
}

/** Lower-case, letters and digits only: "Spring Boot" ≈ "springboot" ≈ "spring-boot". */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]+/g, "");

/** Words people use for a skill that profile.ts spells differently. */
const ALIASES: Record<string, string> = {
  js: "JavaScript",
  ts: "TypeScript",
  next: "Next.js",
  nextjs: "Next.js",
  spring: "Spring Boot",
  springboot: "Spring Boot",
  jpa: "Spring Data JPA",
  sql: "SQL/MySQL",
  mysql: "SQL/MySQL",
  html: "HTML5",
  css: "CSS3",
  tailwind: "Tailwind CSS",
  threejs: "Three.js",
  rag: "RAG fundamentals",
  genai: "Generative AI APIs",
  generativeai: "Generative AI APIs",
  ai: "Generative AI APIs",
  kotlin: "Kotlin",
  node: "Node.js",
  nodejs: "Node.js",
  rest: "REST APIs",
  angular: "AngularJS",
  py: "Python",
  cpp: "C++",
  sockets: "Socket programming",
  socket: "Socket programming",
  threads: "Multithreading",
  threading: "Multithreading",
  aes: "Encryption (AES-256)",
  encryption: "Encryption (AES-256)",
};

export function allSkills(): string[] {
  return Object.values(profile.skills).flat();
}

/** The skill from profile.ts a visitor's word refers to, or null. */
export function matchSkill(raw: string): string | null {
  const q = norm(raw);
  if (!q) return null;
  const skills = allSkills();
  const alias = ALIASES[q];
  if (alias && skills.includes(alias)) return alias;
  const exact = skills.find((s) => norm(s) === q);
  if (exact) return exact;
  if (q.length < 3) return null;
  return skills.find((s) => norm(s).startsWith(q) || (q.length >= 4 && norm(s).includes(q))) ?? null;
}

const clip = (t: string, n = 160) => (t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`);

export function skillEvidence(raw: string): UiPart {
  const skill = matchSkill(raw);
  if (!skill) return { kind: "skill", skill: raw.trim().slice(0, 40), found: false, where: [] };
  const where: Extract<UiPart, { kind: "skill" }>["where"] = [];
  for (const slug of projectsUsing(skill)) {
    const p = projectBySlug(slug)!;
    const used = p.stack.filter((s) => usesSkill(skill, s));
    where.push({
      type: "project",
      title: p.name,
      detail: `${p.tagline}. Stack: ${(used.length ? used : p.stack.slice(0, 3)).join(", ")}`,
      href: `/work/${p.slug}`,
    });
  }
  // the roles that are not a project of their own (the same rule as the Stack map), from each role's own stack
  for (const job of roleNodes()) {
    const items = job.stack.filter((s) => usesSkill(skill, s));
    if (!items.length) continue;
    const point = job.points.find((pt) => items.some((it) => norm(pt).includes(norm(it)))) ?? job.points[0]!;
    where.push({
      type: "experience",
      title: `${job.role}, ${job.short}`,
      detail: clip(point),
      href: "/#experience",
    });
  }
  // nothing on the map used it: a leadership role, this site, a certificate, or coursework & practice
  const other = where.length ? null : elsewhere(skill);
  if (other?.kind === "leadership")
    where.push({
      type: "experience",
      title: `Leadership: ${other.text.split("—")[0]!.trim()}`,
      detail: clip(other.text),
      href: "/resume",
    });
  if (other?.kind === "site")
    where.push({ type: "project", title: "This portfolio", detail: other.text, href: "/#ask" });
  if (other?.kind === "certification")
    where.push({ type: "education", title: "Certificate", detail: clip(other.text), href: "/resume" });
  const group = (Object.entries(profile.skills) as Array<[string, string[]]>).find(([, items]) =>
    items.includes(skill),
  );
  if (group)
    where.push({
      type: "skills",
      title: "Listed under his skills",
      detail: `${skill} (${group[0]})`,
      href: "/#stack",
    });
  // Skills no project, role or activity shows: Vishal says he learned them in his degrees.
  if (other?.kind === "coursework" && group)
    where.push({
      type: "education",
      title: "Coursework & practice",
      detail: profile.skillsNote,
      href: "/#experience",
    });
  return { kind: "skill", skill, found: where.length > 0, where };
}

/** The roles that can be shown as a card: every entry in profile.experience, by its short name ("Cove IoT"). */
export const ROLE_NAMES = profile.experience.map((e) => e.short) as [string, ...string[]];

/** A role as a card: title, company, dates, its first line, and what it used. Built from profile.ts only. */
export function rolePart(short: string): UiPart | null {
  const e = profile.experience.find((x) => x.short.toLowerCase() === short.toLowerCase());
  if (!e) return null;
  return {
    kind: "role",
    id: roleId(e),
    title: e.role,
    company: e.company,
    short: e.short,
    period: e.period,
    jobKind: e.kind,
    impact: e.points[0]!,
    stack: e.stack,
    href: "/#experience",
  };
}

/** "Book a call": the Cal.com link when Vishal has set one, otherwise the card offers a message instead. */
export const bookPart = (): UiPart => ({
  kind: "book",
  calLink: profile.contact.calLink,
  mailto: profile.contact.email,
});

/** "Message Vishal": where he is right now, and a button that opens the live chat with a summary to start from. */
export const livePart = (
  presence: { state: "online" | "away"; configured: boolean; time: string },
  summary = "",
): UiPart => ({
  kind: "live",
  summary: summary.slice(0, 1000),
  state: presence.configured ? presence.state : "off",
  time: presence.time,
});

/** The 60-second tour: a card with a button (and the page starts it when GRID produces it live). */
export const tourPart = (): UiPart => ({ kind: "tour", stops: TOUR.length });

/** A message for the visitor to review. The fields are only a proposal: nothing is sent until they confirm. */
export const confirmPart = (m: {
  name?: string;
  email?: string;
  company?: string;
  role?: string;
  message?: string;
}): UiPart => ({
  kind: "confirm",
  action: "send_message",
  name: (m.name ?? "").slice(0, 80),
  email: (m.email ?? "").slice(0, 200),
  company: (m.company ?? "").slice(0, 80),
  role: (m.role ?? "").slice(0, 80),
  message: (m.message ?? "").slice(0, 1500),
  mailto: profile.contact.email,
});

export function demoPart(slug: string, beat?: number): UiPart | null {
  const p = projectBySlug(slug);
  const scene = sceneFor(slug);
  if (!p || !scene) return null;
  const idx = beat !== undefined && beat >= 1 && beat <= scene.beats.length ? beat - 1 : null;
  return {
    kind: "demo",
    slug,
    name: p.name,
    beat: idx,
    label: idx === null ? `${p.name} on the Work stage` : `${p.name}: ${scene.beats[idx]!.label}`,
  };
}

export function diagramPart(slug: string): UiPart | null {
  const p = projectBySlug(slug);
  if (!p || !graphs[p.slug]) return null;
  return { kind: "diagram", slug, name: p.name };
}

export function navigatePart(target: string): UiPart | null {
  const t = resolveTarget(target);
  return t ? { kind: "navigate", target, href: t.href, label: t.label } : null;
}

export async function statsPart(
  statuses: Array<{ slug: string; state: "live" | "degraded" | "offline" | null; latencyMs: number | null }>,
  lighthouseFile: string = LIGHTHOUSE_FILE,
): Promise<UiPart> {
  const lh = readLighthouse(lighthouseFile);
  return {
    kind: "stats",
    lighthouse: lh
      ? {
          performance: displayScore(lh.scores.performance),
          accessibility: displayScore(lh.scores.accessibility),
          bestPractices: displayScore(lh.scores.bestPractices),
          seo: displayScore(lh.scores.seo),
          commit: lh.commit.slice(0, 7),
          generatedAt: lh.generatedAt,
          url: lh.url,
        }
      : null,
    deploy: { builtAt: site.buildTime, commit: site.commitSha },
    products: profile.projects
      .filter((p) => p.live)
      .map((p) => {
        const s = statuses.find((x) => x.slug === p.slug);
        return { slug: p.slug, name: p.name, state: s?.state ?? null, latencyMs: s?.latencyMs ?? null };
      }),
  };
}
