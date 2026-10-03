import type { ContributionDay } from "./types";

export type Streaks = { current: number; longest: number };

const DAY_MS = 86_400_000;
const toUtcDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

/**
 * Current and longest streak of consecutive days with ≥ 1 contribution.
 * `today` (YYYY-MM-DD) is the last day that can still count: a zero today does not break the
 * current streak (the day isn't over), but a zero yesterday does.
 */
export function computeStreaks(days: ContributionDay[], today?: string): Streaks {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return { current: 0, longest: 0 };

  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    const day = toUtcDay(d.date);
    if (d.count > 0) {
      run = prev !== null && day === prev + 1 && run > 0 ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = day;
    } else {
      run = 0;
      prev = day;
    }
  }

  const byDay = new Map(sorted.map((d) => [toUtcDay(d.date), d.count]));
  const last = today ? toUtcDay(today) : toUtcDay(sorted[sorted.length - 1]!.date);
  let cursor = last;
  if ((byDay.get(cursor) ?? 0) === 0) cursor -= 1; // today isn't over yet
  let current = 0;
  while ((byDay.get(cursor) ?? 0) > 0) {
    current += 1;
    cursor -= 1;
  }
  return { current, longest };
}

export const flattenDays = (weeks: ContributionDay[][]) => weeks.flat();
