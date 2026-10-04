import { canonicalSkill } from "@/lib/match/grade";
import { containsTerm } from "@/lib/match/text";
import type { Importance, Requirement } from "@/lib/match/types";
import type { ResumeModel } from "./model";

/**
 * Truth-preserving tailoring. The requirements (from a job description or a focus) decide the ORDER of what the résumé
 * already says, nothing else: bullets move up within their role, projects and skill groups move up, matching skills
 * come first in their group. No sentence is written, rephrased, added or removed, so the résumé still fits one page and
 * every line is something Vishal wrote. Requirements the résumé does not support are reported as gaps, never hidden.
 */
export type TailorSummary = { movedUp: string[]; emphasised: string[]; gaps: string[] };
export type Tailored = { model: ResumeModel; summary: TailorSummary; filename: string };

const WEIGHT: Record<Importance, number> = { high: 3, medium: 2, low: 1 };
const YEARS = /^\d{1,2}\+?\s*years/i;

type Want = { name: string; weight: number; terms: string[] };

/** What to look for in the résumé's text for each requirement (the matcher's own aliases and evidence terms). */
export function wants(requirements: Requirement[]): Want[] {
  return requirements
    .filter((r) => !YEARS.test(r.skill))
    .map((r) => {
      const canon = canonicalSkill(r.skill);
      const terms = canon
        ? [...new Set([...canon.aliases, canon.name.toLowerCase(), ...canon.evidence])]
        : [r.skill.toLowerCase()];
      return { name: canon?.name ?? r.skill, weight: WEIGHT[r.importance], terms };
    });
}

const scoreOf = (text: string, ws: Want[]) =>
  ws.reduce((sum, w) => (w.terms.some((t) => containsTerm(text, t)) ? sum + w.weight : sum), 0);

/** Stable sort by score, highest first; ties keep their original order. */
function rank<T>(
  items: T[],
  score: (item: T) => number,
): { items: T[]; moved: Array<{ item: T; from: number; to: number }> } {
  const scored = items.map((item, i) => ({ item, i, s: score(item) }));
  const sorted = [...scored].sort((a, b) => b.s - a.s || a.i - b.i);
  return {
    items: sorted.map((x) => x.item),
    moved: sorted.flatMap((x, to) => (x.i > to && x.s > 0 ? [{ item: x.item, from: x.i, to }] : [])),
  };
}

const clip = (t: string, n = 70) => (t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`);

export function roleSlug(role: string | null | undefined): string {
  const words = (role ?? "").match(/[A-Za-z0-9]+/g) ?? [];
  const slug = words
    .slice(0, 5)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join("")
    .slice(0, 40);
  return slug || "Tailored";
}

export function tailorResume(base: ResumeModel, requirements: Requirement[], role?: string | null): Tailored {
  const ws = wants(requirements);
  const movedUp: string[] = [];

  const experience = base.experience.map((e) => {
    const r = rank(e.bullets, (b) => scoreOf(b, ws));
    r.moved.forEach((m) => movedUp.push(`${e.org.split(",")[0]}: “${clip(m.item)}”`));
    return { ...e, bullets: r.items };
  });

  const projectScore = (p: ResumeModel["projects"][number]) =>
    scoreOf(`${p.title} ${p.stack} ${p.bullets.join(" ")}`, ws);
  const projects = rank(base.projects, projectScore);
  projects.moved.forEach((m) => movedUp.push(`Project: ${m.item.title}`));
  const projectsOut = projects.items.map((p) => ({
    ...p,
    bullets: rank(p.bullets, (b) => scoreOf(b, ws)).items,
  }));

  const emphasised: string[] = [];
  const skills = rank(base.skills, (g) => scoreOf(`${g.label} ${g.text}`, ws)).items.map((g) => {
    const items = g.text.split(", ");
    const r = rank(items, (it) => scoreOf(it, ws));
    r.moved.forEach((m) => emphasised.push(m.item));
    // a group whose matching skills are already first is unchanged; otherwise matching skills lead
    return { ...g, text: r.items.join(", ") };
  });

  const leadership = rank(base.leadership, (l) =>
    scoreOf(`${l.title} ${l.role} ${l.bullets.join(" ")}`, ws),
  ).items;
  const achievements = rank(base.achievements, (a) => scoreOf(`${a.title} ${a.detail}`, ws)).items;

  // Gaps: requirements nothing in the résumé text supports. They stay gaps.
  const everything = [
    base.summary,
    ...base.experience.flatMap((e) => e.bullets),
    ...base.projects.flatMap((p) => [p.title, p.stack, ...p.bullets]),
    ...base.skills.map((g) => g.text),
    ...base.leadership.flatMap((l) => [l.title, l.role, ...l.bullets]),
    ...base.achievements.map((a) => `${a.title} ${a.detail}`),
  ].join("\n");
  const gaps = ws.filter((w) => !w.terms.some((t) => containsTerm(everything, t))).map((w) => w.name);

  return {
    model: { ...base, experience, projects: projectsOut, skills, leadership, achievements },
    summary: {
      movedUp: movedUp.slice(0, 5),
      emphasised: [...new Set(emphasised)].slice(0, 8),
      gaps: [...new Set(gaps)],
    },
    filename: `Vishal_BG_Resume_${roleSlug(role)}.pdf`,
  };
}
