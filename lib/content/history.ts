import type { Experience } from "@/lib/content/profile-schema";

/**
 * Pure helpers behind the Experience "git history" (components/sections/Experience.tsx).
 * Nothing here is random: hashes come from the text, branch names from the company, and the
 * graph topology from the dates in content/profile.ts.
 */

/** 7-character, git-style id derived from the text (FNV-1a), so a commit keeps its id on every build. */
export function commitId(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 7);
}

const NOISE = /\b(pvt|ltd|private|limited|inc|llp)\b\.?/gi;

/** "Social Agent (Bricstal Pvt. Ltd.), Bengaluru" → "feat/social-agent". */
export function branchName(company: string): string {
  const name = company.split(/[(,]/)[0]!.replace(NOISE, "");
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `feat/${slug || "work"}`;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Jun 2025" → a sortable month number (year × 12 + month); null when the text isn't month-level. */
export function monthIndex(text: string): number | null {
  const m = /([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/.exec(text);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1]!.toLowerCase());
  return month < 0 ? null : Number(m[2]) * 12 + month;
}

/** "Jan 2026 – Present" → { start, end: null (open) }. Throws on a period it can't read, so bad data fails the build. */
export function parsePeriod(period: string): { start: number; end: number | null } {
  const [from = "", to = ""] = period.split(/\s*[–—-]\s*/);
  const start = monthIndex(from);
  if (start === null) throw new Error(`Cannot read the start of period "${period}"`);
  if (/present|now|current/i.test(to)) return { start, end: null };
  const end = monthIndex(to);
  if (end === null) throw new Error(`Cannot read the end of period "${period}"`);
  return { start, end };
}

export type GraphRowKind = "open" | "merge" | "block" | "fork";

export type GraphRow = {
  kind: GraphRowKind;
  /** Index into the experience array. */
  role: number;
  /** Lane of the role's branch (0 is main, branches start at 1). */
  lane: number;
  /** Other branch lanes that are open at this row and simply run straight through it, with the role that owns each. */
  through: Array<{ lane: number; role: number }>;
  /** Month text for fork/merge rows ("Mar 2026"); null for the others. */
  when: string | null;
};

export type CareerGraph = { rows: GraphRow[]; lanes: number };

/** Month text (the part of the period before/after the dash) for the event label. */
const endpoints = (period: string) => {
  const [from = "", to = ""] = period.split(/\s*[–—-]\s*/);
  return { from: from.trim(), to: to.trim() };
};

/**
 * Lays the roles out as branches of one history, newest first (like `git log --graph`):
 * an open role is a branch head; a finished role merges into main at its end date and forks off
 * at its start date. Overlapping roles get separate lanes, so the picture can't claim an order
 * the dates don't support.
 */
export function buildGraph(experience: readonly Pick<Experience, "period">[]): CareerGraph {
  type Event = { t: number; kind: "open" | "merge" | "fork"; role: number };
  const events: Event[] = [];
  experience.forEach((e, role) => {
    const { start, end } = parsePeriod(e.period);
    events.push(end === null ? { t: Infinity, kind: "open", role } : { t: end, kind: "merge", role });
    events.push({ t: start, kind: "fork", role });
  });
  // Newest first; at the same month a merge/head comes before a fork, then the later-listed role first.
  const order = { open: 0, merge: 0, fork: 1 } as const;
  events.sort((a, b) => b.t - a.t || order[a.kind] - order[b.kind] || a.role - b.role);

  const laneOf = new Map<number, number>();
  const active = new Set<number>();
  const rows: GraphRow[] = [];
  let lanes = 1;
  const through = (except: number) =>
    [...active]
      .filter((l) => l !== except)
      .sort((a, b) => a - b)
      .map((lane) => ({ lane, role: laneOf.get(-lane)! }));

  for (const ev of events) {
    const period = endpoints(experience[ev.role]!.period);
    if (ev.kind === "fork") {
      const lane = laneOf.get(ev.role)!;
      rows.push({ kind: "fork", role: ev.role, lane, through: through(lane), when: period.from });
      active.delete(lane);
      continue;
    }
    let lane = 1;
    while (active.has(lane)) lane++;
    laneOf.set(ev.role, lane);
    laneOf.set(-lane, ev.role); // reverse lookup: which role holds this lane right now
    lanes = Math.max(lanes, lane + 1);
    rows.push({
      kind: ev.kind,
      role: ev.role,
      lane,
      through: through(lane),
      when: ev.kind === "merge" ? period.to : null,
    });
    active.add(lane);
    rows.push({ kind: "block", role: ev.role, lane, through: through(lane), when: null });
  }
  return { rows, lanes };
}

/** "Master of Computer Applications (MCA)" + note "Pursuing" → "MCA (in progress)". */
export function educationTag(e: { degree: string; note: string }): string {
  const abbr = /\(([A-Z][A-Za-z.]{1,8})\)\s*$/.exec(e.degree)?.[1] ?? e.degree;
  return /pursuing/i.test(e.note) ? `${abbr} (in progress)` : abbr;
}
