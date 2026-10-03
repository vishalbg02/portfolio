import type { ContributionDay } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Label (and column) for each month that starts a new run of weeks. */
export function monthLabels(weeks: ContributionDay[][]): Array<{ week: number; label: string }> {
  const out: Array<{ week: number; label: string }> = [];
  let prev = -1;
  weeks.forEach((w, i) => {
    const first = w[0];
    if (!first) return;
    const m = Number(first.date.slice(5, 7)) - 1;
    if (m !== prev) {
      const last = out[out.length - 1];
      // A short partial month would crowd its neighbour: let the newer month take its place.
      if (last && i - last.week < 3) out[out.length - 1] = { week: i, label: MONTHS[m]! };
      else out.push({ week: i, label: MONTHS[m]! });
      prev = m;
    }
  });
  return out;
}

export function monthTotals(
  weeks: ContributionDay[][],
): Array<{ key: string; label: string; total: number }> {
  const totals = new Map<string, number>();
  for (const d of weeks.flat())
    totals.set(d.date.slice(0, 7), (totals.get(d.date.slice(0, 7)) ?? 0) + d.count);
  return [...totals].map(([key, total]) => ({
    key,
    label: `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`,
    total,
  }));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function describeDay(d: ContributionDay): string {
  const date = new Date(`${d.date}T00:00:00Z`);
  const label = `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  return d.count === 0
    ? `No contributions on ${label}`
    : `${d.count} contribution${d.count === 1 ? "" : "s"} on ${label}`;
}
