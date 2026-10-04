import "server-only";
import { unstable_cache } from "next/cache";
import { profile } from "@/content/profile";
import { checkProject } from "./ping";
import type { ProjectStatus } from "./types";

/**
 * Probe results live in Next's data cache (shared across instances) for 5 minutes. One place, used by
 * /api/status and by GRID's get_site_stats tool, so both always agree and neither probes more often.
 */
const cachedCheck = unstable_cache(
  (slug: string, url: string | null) => checkProject(slug, url),
  ["project-status-v1"],
  { revalidate: 300, tags: ["project-status"] },
);

export async function getStatuses(): Promise<ProjectStatus[]> {
  return Promise.all(profile.projects.map((p) => cachedCheck(p.slug, p.live)));
}
