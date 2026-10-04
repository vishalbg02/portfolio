import { profile } from "@/content/profile";
import type { Profile } from "@/lib/content/profile-schema";
import { monthIndex } from "./history";

export type MilestoneKind = "award" | "launch";

export type Milestone = {
  id: string;
  /** Month-level date, YYYY-MM. */
  date: string;
  /** "Mar 2026": how the date is shown. */
  when: string;
  /** Short text for the calendar label row. */
  short: string;
  /** Full title for the popover. */
  title: string;
  /** One-line story. */
  story: string;
  kind: MilestoneKind;
  /** Proof: a case study or page on this site. */
  href?: string;
};

/** Where each milestone's proof lives on this site (matched against the event or company name). */
const PROOF: Array<[RegExp, string]> = [
  [/openbuild/i, "/work/lansymphony"],
  [/golden verdict/i, "/work/golden-verdict"],
  [/social agent/i, "/work/talnio"],
];
const proofFor = (text: string) => PROOF.find(([re]) => re.test(text))?.[1];

const ym = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
const ordinal = (place: string) => place.replace(/\s*place$/i, "");

/**
 * Award pins for the activity calendar, derived from content/profile.ts so they can't contradict the
 * rest of the site: every award whose date is known to the month (roles are drawn as bands: lib/content/roles.ts). Anything
 * dated only to the year (GATEWAYS 2026) is left out rather than guessed.
 * TODO(vishal): add a launch milestone (e.g. Talnio on Google Play) once you know the month.
 */
export function milestones(p: Pick<Profile, "recognition"> = profile): Milestone[] {
  const out: Milestone[] = [];

  for (const r of p.recognition) {
    const idx = monthIndex(r.date);
    if (idx === null) continue;
    out.push({
      id: `award-${ym(idx)}-${r.event.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      date: ym(idx),
      when: r.date,
      short: `${ordinal(r.place)} · ${r.event}`,
      title: `${r.event} — ${r.place}`,
      story: r.detail ? `${r.org}. ${r.detail[0]!.toUpperCase()}${r.detail.slice(1)}.` : `${r.org}.`,
      kind: "award",
      href: proofFor(r.event),
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
