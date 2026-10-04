import type { Profile } from "./profile-schema";

const noun = (kind: Profile["experience"][number]["kind"]) =>
  kind === "internship" ? "internship" : kind === "freelance" ? "freelance role" : "role";
const org = (company: string) => company.split(/[(,]/)[0]!.trim();

/**
 * What Vishal is doing right now, derived from profile.ts so the AI, the terminal and /now can never
 * disagree with the timeline. A role is "current" only if it is flagged current; a current freelance
 * role means "not in a full-time job or internship, but working as a freelancer". With nothing current
 * he is not working anywhere, and the sentence says so and names the most recent roles.
 */
export function workStatus(p: Profile) {
  const currentRole = p.experience.find((e) => e.current) ?? null;
  /** Most recent roles that have ended, newest first as listed in profile.ts. */
  const ended = p.experience.filter((e) => !e.current);
  const lastRole = ended[0] ?? null;
  const freelance = currentRole?.kind === "freelance" ? currentRole : null;
  const employed = currentRole && currentRole.kind !== "freelance" ? currentRole : null;

  const past = (e: (typeof ended)[number]) => `${e.role} at ${org(e.company)} (${e.period}, ${noun(e.kind)})`;
  const sentence = employed
    ? `He currently works as ${employed.role} at ${employed.company} (${employed.period}).`
    : freelance
      ? `He is not currently in a full-time job or internship. He currently works as a freelance ${freelance.role} at ${org(freelance.company)} (${freelance.period}).${lastRole ? ` His most recent internship was ${lastRole.role} at ${lastRole.company}, ${lastRole.period}.` : ""}`
      : `He is not currently working anywhere${
          lastRole
            ? `: his most recent role was ${past(lastRole)}, and he is available to start`
            : ", and he is available to start"
        }.${ended[1] ? ` Before that: ${past(ended[1])}.` : ""}`;
  return { currentRole, lastRole, freelance, employed, sentence };
}
