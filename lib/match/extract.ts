import { SKILLS } from "./taxonomy";
import { containsTerm } from "./text";
import { MAX_REQUIREMENTS, type Importance, type Requirement } from "./types";

const HIGH =
  /\b(must|required|requirements?|essential|mandatory|strong|proficien\w*|expert\w*|hands-on|minimum|key)\b/i;
const LOW =
  /\b(nice to have|nice-to-have|preferred|bonus|plus|good to have|desirable|advantage|optional|familiarity)\b/i;

const sentencesOf = (jd: string) =>
  jd
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Highest "N+ years" figure mentioned alongside "experience", or null. */
export function yearsRequired(jd: string): { years: number; importance: Importance } | null {
  let best: { years: number; importance: Importance } | null = null;
  for (const sentence of sentencesOf(jd)) {
    if (!/experience/i.test(sentence)) continue;
    for (const m of sentence.matchAll(/(\d{1,2})\s*\+?\s*(?:[-–]\s*(\d{1,2})\s*)?(?:years?|yrs?)\b/gi)) {
      const years = Number(m[2] ?? m[1]);
      if (years >= 1 && years <= 20 && (!best || years > best.years)) {
        best = { years, importance: LOW.test(sentence) ? "low" : "high" };
      }
    }
  }
  return best;
}

/**
 * Offline requirement extraction: finds every taxonomy skill mentioned in the job description and
 * rates importance from the wording around it ("required" vs "nice to have") and how often it appears.
 */
export function extractRequirements(jd: string, max = MAX_REQUIREMENTS): Requirement[] {
  const sentences = sentencesOf(jd);
  const found: Array<{ id: string; name: string; importance: Importance; order: number; hits: string[] }> =
    [];

  for (const skill of SKILLS) {
    let mentions = 0;
    let high = false;
    let low = false;
    let order = Infinity;
    const hits = new Set<string>();
    sentences.forEach((sentence, i) => {
      const matched = skill.aliases.filter((a) => containsTerm(sentence, a));
      if (matched.length > 0) {
        matched.forEach((a) => hits.add(a));
        mentions += 1;
        order = Math.min(order, i);
        if (HIGH.test(sentence)) high = true;
        if (LOW.test(sentence)) low = true;
      }
    });
    if (mentions === 0) continue;
    const importance: Importance = low && !high ? "low" : high || mentions >= 2 ? "high" : "medium";
    found.push({ id: skill.id, name: skill.name, importance, order, hits: [...hits] });
  }

  // "Spring Boot" must not also yield "Spring"; "React Native" must not also yield "React".
  const covered = (f: (typeof found)[number]) =>
    f.hits.every((h) =>
      found.some((o) => o.id !== f.id && o.hits.some((oh) => oh !== h && containsTerm(oh, h))),
    );
  const kept = found.filter((f) => !covered(f));

  const years = yearsRequired(jd);
  const rank = { high: 0, medium: 1, low: 2 } as const;
  const list: Requirement[] = kept
    .sort((a, b) => rank[a.importance] - rank[b.importance] || a.order - b.order)
    .map((f) => ({ skill: f.name, importance: f.importance }));
  if (years) list.unshift({ skill: `${years.years}+ years of experience`, importance: years.importance });
  return list.slice(0, max);
}
