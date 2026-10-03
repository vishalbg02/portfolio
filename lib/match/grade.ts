import { profile as defaultProfile } from "@/content/profile";
import type { Profile } from "@/lib/content/profile-schema";
import { tokenize } from "@/lib/rag/text";
import type { Chunk } from "@/lib/rag/types";
import { experienceSummary } from "./experience";
import { SKILLS, SKILL_BY_ID, type Skill } from "./taxonomy";
import { containsTerm, snippetFor } from "./text";
import type { MatchItem, MatchLevel, MatchResult, Requirement } from "./types";

/**
 * Deterministic, literal grading — the model never decides who "matches":
 *  strong  = the requirement (or its canonical skill) is literally present in Vishal's content
 *  partial = a RELATED skill is present (e.g. PostgreSQL → SQL), or most words of an unknown
 *            requirement co-occur in one passage
 *  gap     = nothing on the site supports it — shown as a gap, never softened
 */
const YEARS = /^(\d{1,2})\+?\s*years/i;

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** The taxonomy skill a requirement phrase refers to (longest alias wins), or null. */
export function canonicalSkill(requirement: string): Skill | null {
  const r = normalize(requirement);
  let best: { skill: Skill; len: number } | null = null;
  for (const skill of SKILLS) {
    for (const alias of [...skill.aliases, skill.name.toLowerCase()]) {
      if (containsTerm(r, alias) && (!best || alias.length > best.len)) best = { skill, len: alias.length };
    }
  }
  return best?.skill ?? null;
}

const rankChunk = (c: Chunk) =>
  c.id.startsWith("experience-")
    ? 0
    : c.id.startsWith("project-")
      ? 1
      : c.id.startsWith("skills-")
        ? 2
        : c.id.startsWith("about")
          ? 3
          : 4;

function evidenceFor(terms: string[], chunks: Chunk[], limit = 2): MatchItem["evidence"] {
  const hits = chunks
    .map((c) => ({ c, term: terms.find((t) => containsTerm(`${c.title} ${c.text}`, t)) }))
    .filter((h): h is { c: Chunk; term: string } => Boolean(h.term))
    .sort((a, b) => rankChunk(a.c) - rankChunk(b.c));
  return hits
    .slice(0, limit)
    .map(({ c, term }) => ({ text: snippetFor(c.text, term), title: c.title, sourceUrl: c.url }));
}

function gradeSkill(skill: Skill, chunks: Chunk[]): { match: MatchLevel; evidence: MatchItem["evidence"] } {
  const direct = skill.evidence.length ? evidenceFor(skill.evidence, chunks) : [];
  if (direct.length) return { match: "strong", evidence: direct };
  for (const id of skill.related ?? []) {
    const rel = SKILL_BY_ID.get(id);
    const ev = rel?.evidence.length ? evidenceFor(rel.evidence, chunks) : [];
    if (ev.length) return { match: "partial", evidence: ev };
  }
  return { match: "gap", evidence: [] };
}

/**
 * Words that are genuine technology terms in Vishal's own content: his skill lists, project stacks,
 * target skills and certification titles. An unknown requirement may only be credited through these —
 * otherwise an invented word like "Everything" would "match" because it appears somewhere in prose.
 */
function techVocabulary(p: Profile): Set<string> {
  const lists = [
    ...Object.values(p.skills).flat(),
    ...p.projects.flatMap((x) => x.stack),
    ...p.targetRole.coreSkills,
    ...p.certifications,
  ];
  return new Set(lists.flatMap((t) => tokenize(t)));
}

/** Requirement not in the taxonomy: needs real tech vocabulary — literal phrase → strong; most words in one passage → partial. */
function gradeUnknown(
  requirement: string,
  chunks: Chunk[],
  p: Profile,
): { match: MatchLevel; evidence: MatchItem["evidence"] } {
  const words = [...new Set(tokenize(requirement))];
  const vocab = techVocabulary(p);
  const known = words.filter((w) => vocab.has(w));
  if (words.length === 0 || known.length === 0 || known.length / words.length < 0.67)
    return { match: "gap", evidence: [] };

  const phrase = evidenceFor([normalize(requirement)], chunks);
  if (phrase.length) return { match: "strong", evidence: phrase };
  const tokenSets = chunks.map((c) => new Set(tokenize(`${c.title} ${c.text}`)));
  const scored = chunks
    .map((c, i) => ({ c, covered: known.filter((w) => tokenSets[i]!.has(w)).length }))
    .filter((x) => x.covered === known.length)
    .sort((a, b) => rankChunk(a.c) - rankChunk(b.c));
  if (scored.length === 0) return { match: "gap", evidence: [] };
  const evidence = scored.slice(0, 2).map(({ c }) => ({
    text: snippetFor(c.text, known.find((w) => containsTerm(c.text, w)) ?? known[0]!),
    title: c.title,
    sourceUrl: c.url,
  }));
  return { match: words.length === 1 ? "strong" : "partial", evidence };
}

export function gradeRequirement(
  req: Requirement,
  chunks: Chunk[],
  now: Date,
  p: Profile = defaultProfile,
): MatchItem {
  const years = req.skill.match(YEARS);
  if (years) {
    const need = Number(years[1]);
    const have = experienceSummary(p, now);
    const match: MatchLevel = have.years >= need ? "strong" : have.years >= need * 0.75 ? "partial" : "gap";
    return {
      requirement: req.skill,
      importance: req.importance,
      match,
      evidence: [{ text: have.text, title: "Experience", sourceUrl: "/#experience" }],
    };
  }
  const skill = canonicalSkill(req.skill);
  const { match, evidence } = skill ? gradeSkill(skill, chunks) : gradeUnknown(req.skill, chunks, p);
  return { requirement: req.skill, importance: req.importance, match, evidence };
}

export function summarize(
  items: MatchItem[],
  name = "Vishal",
): { summary: string; counts: MatchResult["counts"] } {
  const counts = {
    strong: items.filter((i) => i.match === "strong").length,
    partial: items.filter((i) => i.match === "partial").length,
    gap: items.filter((i) => i.match === "gap").length,
  };
  if (items.length === 0)
    return {
      summary: "No specific requirements were found in that text. Paste the full job description.",
      counts,
    };
  const gaps = items.filter((i) => i.match === "gap");
  const highGaps = gaps.filter((i) => i.importance === "high").map((i) => i.requirement);
  const parts = [
    `${name} has direct evidence for ${counts.strong} of ${items.length} requirements${counts.partial ? ` and related experience for ${counts.partial} more` : ""}.`,
    gaps.length
      ? `Not covered: ${gaps.map((g) => g.requirement).join(", ")}${highGaps.length ? ` (high priority: ${highGaps.join(", ")})` : ""}.`
      : "No gaps found against the stated requirements.",
  ];
  return { summary: parts.join(" "), counts };
}

export function gradeAll(
  reqs: Requirement[],
  chunks: Chunk[],
  now: Date,
  mode: MatchResult["mode"],
  p: Profile = defaultProfile,
): MatchResult {
  const results = reqs.map((r) => gradeRequirement(r, chunks, now, p));
  return { mode, results, ...summarize(results, p.name.split(" ")[0]) };
}
