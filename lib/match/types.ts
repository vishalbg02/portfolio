import { z } from "zod";

/** Most requirements ever shown (a rich JD can name more; the strongest-signal ones win). */
export const MAX_REQUIREMENTS = 14;

export const ImportanceSchema = z.enum(["high", "medium", "low"]);
export type Importance = z.infer<typeof ImportanceSchema>;

/** What the model (or the keyword extractor) returns. */
export const RequirementsSchema = z.object({
  requirements: z
    .array(z.object({ skill: z.string().trim().min(1).max(60), importance: ImportanceSchema }))
    .max(MAX_REQUIREMENTS),
});
export type Requirement = z.infer<typeof RequirementsSchema>["requirements"][number];

export const MatchLevelSchema = z.enum(["strong", "partial", "gap"]);
export type MatchLevel = z.infer<typeof MatchLevelSchema>;

export const EvidenceSchema = z.object({
  text: z.string(),
  title: z.string(),
  sourceUrl: z.string(),
});

export const MatchItemSchema = z.object({
  requirement: z.string(),
  importance: ImportanceSchema,
  match: MatchLevelSchema,
  evidence: z.array(EvidenceSchema).max(3),
});
export type MatchItem = z.infer<typeof MatchItemSchema>;

/** The API response. Validated before it leaves the server. */
export const MatchResultSchema = z.object({
  mode: z.enum(["ai", "keyword"]),
  summary: z.string(),
  counts: z.object({ strong: z.number(), partial: z.number(), gap: z.number() }),
  results: z.array(MatchItemSchema).max(MAX_REQUIREMENTS + 1),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;
