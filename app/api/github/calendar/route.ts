import { NextResponse } from "next/server";
import { getGithubYear } from "@/lib/github/data";

/**
 * One calendar year of contributions for the activity switcher: GET /api/github/calendar?year=2025.
 * Live with GITHUB_TOKEN (cached an hour by Next's data cache), otherwise the committed per-year snapshot.
 */
export async function GET(req: Request) {
  const now = Date.now();
  const raw = new URL(req.url).searchParams.get("year") ?? "";
  const year = /^\d{4}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(year) || year < 2008 || year > new Date(now).getUTCFullYear()) {
    return NextResponse.json({ error: "Pass ?year=YYYY (2008 to this year)." }, { status: 400 });
  }
  const data = await getGithubYear(year, now);
  if (!data) return NextResponse.json({ error: `No data for ${year}.` }, { status: 404 });
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
