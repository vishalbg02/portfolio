import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { profile } from "@/content/profile";
import { checkProject } from "@/lib/status/ping";
import type { StatusResponse } from "@/lib/status/types";

// Probe results live in Next's data cache (shared across instances) for 5 minutes,
// and the CDN may serve the response itself for the same window.
const cachedCheck = unstable_cache(
  (slug: string, url: string | null) => checkProject(slug, url),
  ["project-status-v1"],
  { revalidate: 300, tags: ["project-status"] },
);

export async function GET() {
  const results = await Promise.all(profile.projects.map((p) => cachedCheck(p.slug, p.live)));
  const body: StatusResponse = {
    checkedAt: new Date().toISOString(),
    statuses: Object.fromEntries(results.map((r) => [r.slug, r])),
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
