import { z } from "zod";
import { features } from "@/lib/env";
import { json, sameOrigin } from "@/lib/http";
import { recordEvent } from "@/lib/links/service";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const Body = z.object({ c: z.string().min(10).max(40), e: z.enum(["resume", "chat"]) });

/** From a personal link: the résumé was downloaded, or a chat started. Tells Vishal (at most once an hour per kind). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (!features.live) return json({ ok: false }, 404);
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ ok: false }, 400);
  const limited = await rateLimit({ scope: "link-event", limit: 10, windowSec: 60 }, clientKey(req.headers));
  if (!limited.ok)
    return json({ error: "rate_limited" }, 429, { "Retry-After": String(limited.retryAfterSec) });
  try {
    return json({ ok: await recordEvent(body.data.c, body.data.e) });
  } catch (err) {
    console.error("[link] event failed:", (err as Error).message);
    return json({ ok: false }, 500);
  }
}
