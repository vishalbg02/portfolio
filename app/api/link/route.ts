import { z } from "zod";
import { features } from "@/lib/env";
import { json, sameOrigin } from "@/lib/http";
import { recordOpen } from "@/lib/links/service";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const Query = z.object({ c: z.string().min(10).max(40) });

/**
 * A personal link was opened. The signed code is checked first; only the company and role Vishal typed come back.
 * The first open in six hours tells him on Telegram. A bad, expired or unknown code is a plain 404 (it says nothing about why).
 */
export async function GET(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (!features.live) return json({ ok: false }, 404);
  const q = Query.safeParse({ c: new URL(req.url).searchParams.get("c") });
  if (!q.success) return json({ ok: false }, 404);
  const limited = await rateLimit({ scope: "link", limit: 20, windowSec: 60 }, clientKey(req.headers));
  if (!limited.ok)
    return json({ error: "rate_limited" }, 429, { "Retry-After": String(limited.retryAfterSec) });
  try {
    const info = await recordOpen(q.data.c);
    return info
      ? json({ ok: true, company: info.company, role: info.role, id: info.id })
      : json({ ok: false }, 404);
  } catch (err) {
    console.error("[link] open failed:", (err as Error).message);
    return json({ ok: false }, 404);
  }
}
