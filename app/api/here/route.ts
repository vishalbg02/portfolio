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
  // One address can be a whole office or campus, and each open tab beats twice a minute, so the allowance is generous.
  // Over it, the answer is a quiet "not counted" (202), never an error status: the wall is decoration and must not put
  // a failed request in a visitor's console.
  const limited = await rateLimit({ scope: "here", limit: 20, windowSec: 60 }, clientKey(req.headers));
  if (!limited.ok)
    return json({ throttled: true }, 202, { ...NO_STORE, "Retry-After": String(limited.retryAfterSec) });
  return json(await heartbeat(parsed.data.v), 200, NO_STORE);
}
