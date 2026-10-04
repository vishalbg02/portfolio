import { runMatch } from "@/lib/match/run";
import { extractRequirements } from "@/lib/match/extract";
import type { Requirement } from "@/lib/match/types";
import { buildResumeModel } from "@/lib/resume/model";
import { tailorResume } from "@/lib/resume/tailor";
import type { UiPart } from "../protocol";

/** A role label that is safe to print and to put in a file name. */
export const cleanRole = (role: string | null | undefined) =>
  (role ?? "")
    .replace(/[^A-Za-z0-9 +#.,&/()-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60) || null;

/** The requirements to tailor for: from a pasted job description (the matcher extracts them) or a short focus. */
export async function requirementsFor(input: { jdText?: string; focus?: string }): Promise<Requirement[]> {
  if (input.jdText) {
    const matched = await runMatch(input.jdText);
    return matched.results.map((r) => ({ skill: r.requirement, importance: r.importance }));
  }
  return input.focus ? extractRequirements(input.focus) : [];
}

export function resumeCard(requirements: Requirement[], role?: string | null): UiPart {
  const label = cleanRole(role);
  const { summary } = tailorResume(buildResumeModel(), requirements, label);
  return { kind: "resume", role: label, requirements, ...summary };
}
