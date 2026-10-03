import { getAllPosts } from "@/lib/content/log";
import { buildRss } from "@/lib/content/rss";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export async function GET() {
  return new Response(buildRss(await getAllPosts(), site.url), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
