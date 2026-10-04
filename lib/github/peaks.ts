import type { ContributionDay } from "./types";

export type Peak = { date: string; count: number; rank: number };

/** The busiest days in a calendar (highest count first; a tie goes to the more recent day). Days with nothing don't qualify. */
export function peakDays(days: ContributionDay[], n = 3): Peak[] {
  return [...days]
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count || b.date.localeCompare(a.date))
    .slice(0, n)
    .map((d, i) => ({ date: d.date, count: d.count, rank: i + 1 }));
}

const DAY = 86_400_000;
const dayNum = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY);
/** Monday-start ISO week key, so a "week" matches how people count them. */
const weekStart = (iso: string) => {
  const n = dayNum(iso);
  const dow = (new Date(n * DAY).getUTCDay() + 6) % 7; // Mon = 0
  return new Date((n - dow) * DAY).toISOString().slice(0, 10);
};

/** The week (Mon–Sun) and the calendar month with the most contributions. Ties go to the more recent one. */
export function busiest(days: ContributionDay[]) {
  const weeks = new Map<string, number>();
  const months = new Map<string, number>();
  for (const d of days) {
    weeks.set(weekStart(d.date), (weeks.get(weekStart(d.date)) ?? 0) + d.count);
    months.set(d.date.slice(0, 7), (months.get(d.date.slice(0, 7)) ?? 0) + d.count);
  }
  const top = (m: Map<string, number>) =>
    [...m].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0])).filter(([, n]) => n > 0)[0] ?? null;
  const w = top(weeks);
  const mo = top(months);
  return {
    week: w ? { start: w[0], total: w[1] } : null,
    month: mo ? { key: mo[0], total: mo[1] } : null,
  };
}
