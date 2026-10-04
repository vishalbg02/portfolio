/**
 * Dependency-free pieces of lib/content/roles.ts, so client components can use them without pulling
 * profile.ts and its Zod schema into the browser bundle.
 */
export type RoleSpan = {
  id: string;
  /** "Social Agent" */
  label: string;
  /** "internship" | "freelance" | "full-time" */
  kind: "internship" | "freelance" | "full-time";
  role: string;
  period: string;
  /** Inclusive months as YYYY-MM; `end` is null while the role is open. */
  start: string;
  end: string | null;
  href?: string;
};

/** The role (if any) covering a YYYY-MM-DD date, for "during the … internship" notes. */
export function roleOn(date: string, spans: RoleSpan[]): RoleSpan | null {
  const m = date.slice(0, 7);
  return spans.find((s) => s.start <= m && (s.end === null || m <= s.end)) ?? null;
}
