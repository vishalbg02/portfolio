import "server-only";
import { generateText, Output } from "ai";
import { consumeDaily } from "@/lib/ai/budget";
import { LIMITS } from "@/lib/ai/limits";
import { MATCH_INSTRUCTIONS } from "@/lib/ai/prompts";
import { getProvider } from "@/lib/ai/provider";
import { getRetriever } from "@/lib/rag/store";
import { extractRequirements, yearsRequired } from "./extract";
import { gradeAll } from "./grade";
import {
  MAX_REQUIREMENTS,
  MatchResultSchema,
  RequirementsSchema,
  type MatchResult,
  type Requirement,
} from "./types";

/** Model-assisted extraction. Returns null on ANY problem so the caller can fall back to keywords. */
async function extractWithModel(jd: string): Promise<Requirement[] | null> {
  const provider = getProvider();
  if (!provider) return null;
  if (!(await consumeDaily()).ok) return null;
  try {
    const { output } = await generateText({
      model: provider.matchModel(),
      instructions: MATCH_INSTRUCTIONS,
      // The job description is DATA: delimited, never concatenated into the instructions.
      prompt: `<job_description>\n${jd}\n</job_description>`,
      output: Output.object({ schema: RequirementsSchema }),
      maxOutputTokens: LIMITS.matchMaxOutputTokens,
      temperature: 0,
      abortSignal: AbortSignal.timeout(LIMITS.requestTimeoutMs),
    });
    const parsed = RequirementsSchema.safeParse(output);
    return parsed.success ? dedupe(parsed.data.requirements) : null;
  } catch (err) {
    console.error("[ai] match extraction failed, using keyword extraction:", (err as Error).message);
    return null;
  }
}

const dedupe = (reqs: Requirement[]) => {
  const seen = new Set<string>();
  return reqs.filter((r) => {
    const k = r.skill.toLowerCase();
    return seen.has(k) ? false : (seen.add(k), true);
  });
};

/**
 * Matches a job description against Vishal's content. Only the extraction may use a model; the
 * grading is deterministic literal-evidence matching, so the result can't flatter or invent.
 */
export async function runMatch(jd: string, now = new Date()): Promise<MatchResult> {
  const fromModel = await extractWithModel(jd);
  const base = fromModel && fromModel.length > 0 ? fromModel : extractRequirements(jd);
  // "N+ years of experience" is computed deterministically (the model often skips it).
  const years = yearsRequired(jd);
  const requirements =
    years && !base.some((r) => /^\d+\+?\s*years/i.test(r.skill))
      ? [{ skill: `${years.years}+ years of experience`, importance: years.importance }, ...base].slice(
          0,
          MAX_REQUIREMENTS,
        )
      : base;
  const mode: MatchResult["mode"] = fromModel && fromModel.length > 0 ? "ai" : "keyword";
  const chunks = getRetriever().chunkList();
  console.info("[ai]", JSON.stringify({ route: "match", mode, requirements: requirements.length }));
  return MatchResultSchema.parse(gradeAll(requirements, chunks, now, mode));
}
