import { json, sameOrigin } from "@/lib/http";
import { deliverToVishal } from "@/lib/notify/deliver";
import { orgOf } from "@/lib/notify/telegram";
import { claimOnce, releaseClaim, underDailyCap } from "@/lib/notify/once";
import { GridMessageSchema } from "@/lib/notify/schema";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 6_000;
/** Everyone together, per day: a ceiling that no single attacker can raise. */
const DAILY_CAP = 60;
export const maxDuration = 20;

/**
 * Delivers a message the visitor wrote and confirmed in GRID's chat card. The model never calls this: it only
 * prepares the card. Validation, a honeypot, per-client and global limits, and once-only delivery all happen here.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const parsed = GridMessageSchema.safeParse(payload);
  if (!parsed.success) {
    // Honeypot filled: pretend it worked, so a bot learns nothing.
    const honey = (payload as { website?: unknown } | null)?.website;
    if (typeof honey === "string" && honey.length > 0) return json({ ok: true });
    return json(
      {
        error: "invalid",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      400,
    );
  }
  const m = parsed.data;

  const key = clientKey(req.headers);
  const burst = await rateLimit({ scope: "grid-msg", limit: 3, windowSec: 600 }, key);
  if (!burst.ok) return json({ error: "rate_limited" }, 429, { "Retry-After": String(burst.retryAfterSec) });
  const day = await rateLimit({ scope: "grid-msg-day", limit: 8, windowSec: 86_400 }, key);
  if (!day.ok) return json({ error: "rate_limited" }, 429, { "Retry-After": String(day.retryAfterSec) });
  if (!(await underDailyCap("grid-msg", DAILY_CAP))) return json({ error: "busy" }, 503);

  // The same request id is delivered once: a double click or a retry gets the same "ok" and nothing more is sent.
  if (!(await claimOnce(`gridmsg:${m.requestId}`, 600))) return json({ ok: true, duplicate: true });

  const delivery = await deliverToVishal({
    name: m.name,
    email: m.email,
    message: m.message,
    org: orgOf(m.company, m.role),
    page: m.page,
    ipHash: key,
  });
  if (delivery.attempted.length === 0) {
    await releaseClaim(`gridmsg:${m.requestId}`);
    return json({ error: "not_configured", fallback: "mailto" }, 503);
  }
  if (delivery.delivered.length === 0) {
    await releaseClaim(`gridmsg:${m.requestId}`); // let them try again
    return json({ error: "send_failed", fallback: "mailto" }, 502);
  }
  return json({ ok: true });
}
