import { NextResponse } from "next/server";
import { getStatuses } from "@/lib/status/cache";
import type { StatusResponse } from "@/lib/status/types";

export async function GET() {
  const results = await getStatuses();
  const body: StatusResponse = {
    checkedAt: new Date().toISOString(),
    statuses: Object.fromEntries(results.map((r) => [r.slug, r])),
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
