import type { Chunk, Retrieved } from "./types";

/** True for the chunks that belong to one project: its overview and its case-study sections. */
export const belongsToProject = (c: Pick<Chunk, "id">, slug: string) =>
  c.id === `project-${slug}` || c.id.startsWith(`case-${slug}-`);

/**
 * "Ask about this project": that project's chunks go first (keeping their relative order), then the
 * rest. If retrieval found none, the project overview is pulled in, so a scoped question always has
 * its own project's facts in front of the model.
 */
export function scopeResults(results: Retrieved[], slug: string, all: readonly Chunk[]): Retrieved[] {
  const mine = results.filter((r) => belongsToProject(r.chunk, slug));
  const rest = results.filter((r) => !belongsToProject(r.chunk, slug));
  if (mine.length === 0) {
    const overview = all.find((c) => c.id === `project-${slug}`);
    if (overview) mine.push({ chunk: overview, score: 0, rank: 0 });
  }
  return [...mine, ...rest].map((r, i) => ({ ...r, rank: i + 1 }));
}
