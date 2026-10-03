import type { Profile } from "./profile-schema";

/**
 * What Vishal is doing right now, derived from profile.ts so the AI, the terminal and /now can never
 * disagree with the timeline. An employment/internship is "current" only if it is flagged current;
 * a project whose period ends in "Present" counts as ongoing freelance/side work.
 */
export function workStatus(p: Profile) {
  const currentRole = p.experience.find((e) => e.current) ?? null;
  const lastRole = p.experience.find((e) => !e.current) ?? null;
  const ongoing = p.projects
    .filter((x) => /present/i.test(x.period ?? ""))
    .filter((x) => !currentRole || !x.type.includes("Internship"));
  const start = (period: string | null) => (period ?? "").split(/\s*[–—-]\s*/)[0] ?? "";

  const ongoingText = ongoing.map(
    (x) => `${x.name} (${x.type.split(" · ")[0]!.toLowerCase()}, since ${start(x.period)})`,
  );
  /** One plain sentence about employment, safe to quote. */
  const sentence = currentRole
    ? `He currently works as ${currentRole.role} at ${currentRole.company} (${currentRole.period}).`
    : `He is not currently in a full-time job or internship.${
        ongoing.length ? ` He is working on ${ongoingText.join(" and ")}.` : ""
      }${lastRole ? ` His most recent internship was ${lastRole.role} at ${lastRole.company}, ${lastRole.period}.` : ""}`;
  return { currentRole, lastRole, ongoing, ongoingText, sentence };
}
