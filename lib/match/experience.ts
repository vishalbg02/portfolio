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

/** Total professional (internship) experience from profile.ts — computed, never typed in by hand. */
export function experienceSummary(p: Profile, now: Date) {
  const parts = p.experience.map((e) => ({
    role: e.role,
    period: e.period,
    months: periodMonths(e.period, now),
  }));
  const months = parts.reduce((n, x) => n + (x.months ?? 0), 0);
  const years = Math.round((months / 12) * 10) / 10;
  const text = `${parts.map((x) => `${x.role} (${x.period})`).join(" and ")} — about ${years} year${years === 1 ? "" : "s"} of internship experience in total.`;
  return { months, years, text };
}
