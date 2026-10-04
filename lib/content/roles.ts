import { profile } from "@/content/profile";
import type { Profile } from "@/lib/content/profile-schema";
import { parsePeriod } from "./history";
import type { RoleSpan } from "./role-span";

export type { RoleSpan } from "./role-span";
export { roleOn } from "./role-span";

const ym = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
const PROOF: Array<[RegExp, string]> = [
  [/golden verdict/i, "/work/golden-verdict"],
  [/social agent/i, "/work/talnio"],
];

/** Each role as a span of months (drawn as a band over the activity calendar), derived from profile.ts. */
export function roleSpans(p: Pick<Profile, "experience"> = profile): RoleSpan[] {
  return p.experience.map((e) => {
    const { start, end } = parsePeriod(e.period);
    const label = e.company.split(/[(,]/)[0]!.trim();
    return {
      id: `role-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label,
      kind: e.kind,
      role: e.role,
      period: e.period,
      start: ym(start),
      end: end === null ? null : ym(end),
      href: PROOF.find(([re]) => re.test(e.company))?.[1],
    };
  });
}
