import { z } from "zod";
import { json, sameOrigin } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { heartbeat } from "@/lib/presence/service";
import { validVisitor } from "@/lib/presence/wall";

const Body = z.object({ v: z.string().refine(validVisitor) });
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * "Still here": a visible tab sends this every 30 seconds with an id made for that tab. The answer is the count and the
 * lit squares of the visitor wall. Nothing about the visitor is stored but the random id, for 75 seconds.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403, NO_STORE);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid" }, 400, NO_STORE);
  const limited = await rateLimit({ scope: "here", limit: 6, windowSec: 60 }, clientKey(req.headers));
  if (!limited.ok)
    return json({ error: "rate_limited" }, 429, {
      ...NO_STORE,
      "Retry-After": String(limited.retryAfterSec),
    });
  return json(await heartbeat(parsed.data.v), 200, NO_STORE);
}
