import type { Profile } from "@/lib/content/profile-schema";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function parseMonth(s: string, now: Date): number | null {
  if (/present|current|now/i.test(s)) return now.getUTCFullYear() * 12 + now.getUTCMonth();
  const m = s.trim().match(/([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1]!.toLowerCase());
  return idx < 0 ? null : Number(m[2]) * 12 + idx;
}

/** "May 2025 – Present" → inclusive months, or null if the period can't be parsed. */
export function periodMonths(period: string, now: Date): number | null {
  const [a, b] = period.split(/\s*[–—-]\s*/);
  if (!a || !b) return null;
  const start = parseMonth(a, now);
  const end = parseMonth(b, now);
  return start === null || end === null || end < start ? null : end - start + 1;
}

/** First and last month index of a period ("May 2025 – Present"), or null if it can't be parsed. */
function monthRange(period: string, now: Date): [number, number] | null {
  const [a, b] = period.split(/\s*[–—-]\s*/);
  if (!a || !b) return null;
  const start = parseMonth(a, now);
  const end = parseMonth(b, now);
  return start === null || end === null || end < start ? null : [start, end];
}

/**
 * Total professional experience (internships and freelance) from profile.ts: computed, never typed in by
 * hand. Months are counted once even when roles overlap (the freelance role runs alongside an internship).
 */
export function experienceSummary(p: Profile, now: Date) {
  const parts = p.experience.map((e) => ({
    role: e.role,
    period: e.period,
    kind: e.kind,
    months: periodMonths(e.period, now),
  }));
  const covered = new Set<number>();
  for (const e of p.experience) {
    const r = monthRange(e.period, now);
    if (r) for (let m = r[0]; m <= r[1]; m++) covered.add(m);
  }
  const months = covered.size;
  const years = Math.round((months / 12) * 10) / 10;
  const label = (k: string) => (k === "freelance" ? "freelance" : k === "internship" ? "internship" : "");
  const text = `${parts.map((x) => `${x.role}${label(x.kind) ? ` (${label(x.kind)})` : ""}, ${x.period}`).join("; ")} — about ${years} year${years === 1 ? "" : "s"} of professional experience in total (internships and freelance, overlapping months counted once).`;
  return { months, years, text };
}
