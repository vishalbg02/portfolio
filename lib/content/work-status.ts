import type { Profile } from "./profile-schema";

/**
 * What Vishal is doing right now, derived from profile.ts so the AI, the terminal and /now can never
 * disagree with the timeline. A role is "current" only if it is flagged current; a current freelance
 * role means "not in a full-time job or internship, but working as a freelancer".
 */
export function workStatus(p: Profile) {
  const currentRole = p.experience.find((e) => e.current) ?? null;
  /** Most recent role that has ended (internships), newest first as listed in profile.ts. */
  const lastRole = p.experience.find((e) => !e.current) ?? null;
  const freelance = currentRole?.kind === "freelance" ? currentRole : null;
  const employed = currentRole && currentRole.kind !== "freelance" ? currentRole : null;

  const sentence = employed
    ? `He currently works as ${employed.role} at ${employed.company} (${employed.period}).`
    : `He is not currently in a full-time job or internship.${
        freelance
          ? ` He currently works as a freelance ${freelance.role} at ${freelance.company.split(",")[0]} (${freelance.period}).`
          : ""
      }${lastRole ? ` His most recent internship was ${lastRole.role} at ${lastRole.company}, ${lastRole.period}.` : ""}`;
  return { currentRole, lastRole, freelance, employed, sentence };
}
