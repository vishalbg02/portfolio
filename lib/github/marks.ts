import type { Milestone } from "@/lib/content/milestones";
import { roleOn, type RoleSpan } from "@/lib/content/role-span";
import { dayRow, pinsFor } from "./pins";
import type { Peak } from "./peaks";
import type { ContributionDay } from "./types";

export type MarkKind = "award" | "peak" | "role";

/** Everything the activity calendar annotates, in one shape: awards and peak days are pins, roles are bands. */
export type Mark = {
  id: string;
  kind: MarkKind;
  /** YYYY-MM-DD for a peak, YYYY-MM for the rest (used to sort the phone list). */
  date: string;
  when: string;
  /** Short text for the label row. */
  short: string;
  title: string;
  story: string;
  href?: string;
  /** Pin cell (awards, peaks). */
  week?: number;
  day?: number;
  /** Band columns, inclusive (roles). */
  from?: number;
  to?: number;
  cutLeft?: boolean;
  cutRight?: boolean;
  /** Band lane, 0 = top. */
  lane?: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const longDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const RANK = ["Busiest day", "2nd busiest day", "3rd busiest day"];
const NOUN = { internship: "internship", freelance: "freelance role", "full-time": "role" } as const;

/** Columns (weeks) a role covers in this calendar, or null if it is entirely outside it. */
export function bandColumns(
  weeks: ContributionDay[][],
  span: Pick<RoleSpan, "start" | "end">,
): { from: number; to: number; cutLeft: boolean; cutRight: boolean } | null {
  const months = weeks.map((w) => new Set(w.map((d) => d.date.slice(0, 7))));
  const first = weeks[0]?.[0]?.date.slice(0, 7);
  const last = weeks.at(-1)?.at(-1)?.date.slice(0, 7);
  if (!first || !last) return null;
  const end = span.end ?? last;
  if (end < first || span.start > last) return null;
  const from = Math.max(
    0,
    months.findIndex((m) => [...m].some((x) => x >= span.start)),
  );
  let to = weeks.length - 1;
  for (let i = weeks.length - 1; i >= 0; i--)
    if ([...months[i]!].some((x) => x <= end)) {
      to = i;
      break;
    }
  return {
    from,
    to: Math.max(from, to),
    cutLeft: span.start < first,
    cutRight: span.end === null || end > last,
  };
}

/** Puts overlapping bands on separate lanes (first free lane). */
export function assignLanes<T extends { from: number; to: number }>(bands: T[]): Array<T & { lane: number }> {
  const laneEnds: number[] = [];
  return [...bands]
    .sort((a, b) => a.from - b.from || b.to - a.to)
    .map((b) => {
      let lane = laneEnds.findIndex((end) => end < b.from);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = b.to;
      return { ...b, lane };
    });
}

export function buildMarks({
  weeks,
  milestones,
  spans,
  peaks,
}: {
  weeks: ContributionDay[][];
  milestones: Milestone[];
  spans: RoleSpan[];
  peaks: Peak[];
}): { pins: Mark[]; bands: Mark[] } {
  const pins: Mark[] = pinsFor(weeks, milestones).map((p) => ({
    id: p.milestone.id,
    kind: "award",
    date: p.milestone.date,
    when: p.milestone.when,
    short: p.milestone.short,
    title: p.milestone.title,
    story: p.milestone.story,
    href: p.milestone.href,
    week: p.week,
    day: p.day,
  }));

  const cell = new Map<string, { week: number; day: number }>();
  weeks.forEach((w, week) => w.forEach((d) => cell.set(d.date, { week, day: dayRow(d) })));
  for (const pk of peaks) {
    const at = cell.get(pk.date);
    if (!at) continue;
    const during = roleOn(pk.date, spans);
    pins.push({
      id: `peak-${pk.date}`,
      kind: "peak",
      date: pk.date,
      when: longDate(pk.date),
      short: `▲ ${pk.count} · ${shortDate(pk.date)}`,
      title: `${RANK[pk.rank - 1] ?? "Busy day"}: ${pk.count} contributions`,
      story: `${pk.count} contributions on ${longDate(pk.date)}${
        during ? `, during the ${during.label} ${NOUN[during.kind]}` : ""
      }. Commits, pull requests and issues all count.`,
      href: during?.href,
      ...at,
    });
  }

  const bands = assignLanes(
    spans.flatMap((s) => {
      const cols = bandColumns(weeks, s);
      if (!cols) return [];
      return [
        {
          id: s.id,
          kind: "role" as const,
          date: s.start,
          when: s.period,
          short: s.label,
          title: `${s.role}, ${s.label}`,
          story: `${NOUN[s.kind][0]!.toUpperCase()}${NOUN[s.kind].slice(1)}, ${s.end ? "ended" : "ongoing"}. ${s.period}.`,
          href: s.href,
          ...cols,
        },
      ];
    }),
  );
  return { pins, bands };
}
