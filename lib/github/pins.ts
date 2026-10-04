import type { Milestone } from "@/lib/content/milestones";
import type { ContributionDay } from "./types";

export type Pin = {
  milestone: Milestone;
  /** Column and row (Sun = 0) of the cell the pin sits on. */
  week: number;
  day: number;
  /** Label row tier (0 = nearest the calendar). */
  tier: number;
};

const dow = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** Day-of-week row of a cell. Taken from the date (not the array index) so partial weeks line up. */
export const dayRow = (d: ContributionDay) => dow(d.date);

/**
 * Pins the milestones that fall inside this calendar. A month-level milestone sits on the first
 * day of its month that the calendar shows ("month-level dates pin to the first week of that month").
 */
export function pinsFor(weeks: ContributionDay[][], list: Milestone[]): Array<Omit<Pin, "tier">> {
  const first = new Map<string, { week: number; day: number }>();
  weeks.forEach((w, week) =>
    w.forEach((d) => {
      const key = d.date.slice(0, 7);
      if (!first.has(key)) first.set(key, { week, day: dayRow(d) });
    }),
  );
  return list.flatMap((milestone) => {
    const at = first.get(milestone.date);
    return at ? [{ milestone, ...at }] : [];
  });
}

/**
 * Stacks the label row so neighbouring labels never overlap: each pin takes the lowest tier whose
 * last label has already ended. `width(pin)` is the label's width in the same units as `x(pin)`.
 */
export function assignTiers<T extends { week: number }>(
  pins: T[],
  x: (p: T) => number,
  width: (p: T) => number,
  gap = 10,
): Array<T & { tier: number }> {
  const ends: number[] = [];
  return [...pins]
    .sort((a, b) => a.week - b.week)
    .map((p) => {
      const left = x(p);
      let tier = ends.findIndex((end) => end + gap <= left);
      if (tier < 0) tier = ends.length;
      ends[tier] = left + width(p);
      return { ...p, tier };
    });
}
