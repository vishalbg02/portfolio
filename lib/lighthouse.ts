import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * The site's real Lighthouse scores, written by CI (scripts/write-lighthouse.mts) from the
 * representative run of a Lighthouse CI run against production. Never typed in by hand; if the file is
 * missing or malformed the footer strip simply isn't shown.
 */
const Score = z.number().min(0).max(1);
export const LighthouseSchema = z.object({
  generatedAt: z.iso.datetime(),
  url: z.url(),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/),
  runUrl: z.url().nullable(),
  formFactor: z.literal("mobile"),
  runs: z.number().int().positive(),
  scores: z.object({
    performance: Score,
    accessibility: Score,
    bestPractices: Score,
    seo: Score,
  }),
});
export type LighthouseData = z.infer<typeof LighthouseSchema>;

/** 0–1 → 0–100, truncated: 0.996 shows as 99, never rounded up to 100. */
export const displayScore = (n: number) => Math.floor(n * 100 + 1e-9);

export const LIGHTHOUSE_FILE = path.join(process.cwd(), "generated", "lighthouse.json");

export function readLighthouse(file: string = LIGHTHOUSE_FILE): LighthouseData | null {
  try {
    const parsed = LighthouseSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** One Lighthouse CI manifest entry (only the fields we read). */
export type ManifestEntry = {
  url: string;
  isRepresentativeRun?: boolean;
  summary: { performance: number; accessibility: number; "best-practices": number; seo: number };
};

/** Builds the file's content from an LHCI manifest: the representative (median) run's category scores. */
export function fromManifest(
  manifest: ManifestEntry[],
  meta: { generatedAt: string; commit: string; runUrl: string | null },
): LighthouseData {
  const rep = manifest.find((m) => m.isRepresentativeRun) ?? manifest[0];
  if (!rep) throw new Error("Lighthouse manifest has no runs");
  return LighthouseSchema.parse({
    generatedAt: meta.generatedAt,
    url: rep.url,
    commit: meta.commit,
    runUrl: meta.runUrl,
    formFactor: "mobile",
    runs: manifest.length,
    scores: {
      performance: rep.summary.performance,
      accessibility: rep.summary.accessibility,
      bestPractices: rep.summary["best-practices"],
      seo: rep.summary.seo,
    },
  });
}
