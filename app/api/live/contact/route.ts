import { features } from "@/lib/env";
import { json, sameOrigin } from "@/lib/http";
import { LiveContactSchema } from "@/lib/live/schema";
import { captureEmail, defaultDeps } from "@/lib/live/service";
import { verify } from "@/lib/live/token";
import { rateLimit } from "@/lib/rate-limit";

/** "He hasn't replied yet: add your email." Stores the address on the thread so his reply can be emailed. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (!features.live) return json({ error: "not_configured" }, 503);
  const raw = await req.text();
  if (raw.length > 2_000) return json({ error: "too_large" }, 413);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = LiveContactSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const { c, k, email, org } = parsed.data;
  if (!verify(c, k)) return json({ error: "forbidden" }, 403);
  const limit = await rateLimit({ scope: "live-email", limit: 5, windowSec: 3600 }, c);
  if (!limit.ok) return json({ error: "rate_limited" }, 429, { "Retry-After": String(limit.retryAfterSec) });
  const conv = await captureEmail(c, email, org, defaultDeps());
  return conv ? json({ ok: true }) : json({ error: "gone" }, 404);
}
