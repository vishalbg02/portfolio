import { features } from "@/lib/env";
import { json, sameOrigin } from "@/lib/http";
import { LiveMessageSchema } from "@/lib/live/schema";
import { currentPresence } from "@/lib/live/read";
import { defaultDeps, postVisitorMessage, startConversation } from "@/lib/live/service";
import { sign, verify } from "@/lib/live/token";
import { LIVE } from "@/lib/live/types";
import { underDailyCap } from "@/lib/notify/once";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";

export const maxDuration = 20;
const MAX_BODY_BYTES = 8_000;

/**
 * The visitor's side of the live chat: the first message starts a conversation (name required, bot check when a key
 * is set), later ones add to it. Everything is validated, limited and sent to Vishal's Telegram before it is stored.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (!features.live) return json({ error: "not_configured" }, 503);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = LiveMessageSchema.safeParse(payload);
  if (!parsed.success) {
    const honey = (payload as { website?: unknown } | null)?.website;
    if (typeof honey === "string" && honey.length > 0) return json({ ok: true }); // a bot learns nothing
    return json(
      {
        error: "invalid",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      400,
    );
  }
  const m = parsed.data;
  const deps = defaultDeps();
  const key = clientKey(req.headers);

  // ── a later message in an existing conversation ──
  if (m.c) {
    if (!m.k || !verify(m.c, m.k)) return json({ error: "forbidden" }, 403);
    const conv = await deps.store.getConv(m.c);
    if (!conv) return json({ error: "gone" }, 404);
    if (conv.blocked || (await deps.store.isIpBlocked(conv.ipHash)))
      return json({ error: "unavailable" }, 403);
    const hourly = await rateLimit({ scope: "live-msg", limit: LIVE.msgsPerHour, windowSec: 3600 }, m.c);
    if (!hourly.ok)
      return json({ error: "rate_limited" }, 429, { "Retry-After": String(hourly.retryAfterSec) });
    const burst = await rateLimit({ scope: "live-burst", limit: 12, windowSec: 60 }, key);
    if (!burst.ok)
      return json({ error: "rate_limited" }, 429, { "Retry-After": String(burst.retryAfterSec) });
    const sent = await postVisitorMessage(conv, m.message, deps);
    if (!sent.ok) return json({ error: "send_failed", fallback: "mailto" }, 502);
    return json({ ok: true, c: conv.id, k: m.k, n: sent.message.n, presence: await currentPresence(deps) });
  }

  // ── a new conversation ──
  if (!m.name)
    return json({ error: "invalid", issues: [{ path: "name", message: "Please enter your name." }] }, 400);
  if (await deps.store.isIpBlocked(key)) return json({ error: "unavailable" }, 403);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifyTurnstile(m.turnstile, ip))) return json({ error: "bot_check_failed" }, 400);
  const daily = await rateLimit({ scope: "live-conv", limit: LIVE.convsPerDay, windowSec: 86_400 }, key);
  if (!daily.ok) return json({ error: "rate_limited" }, 429, { "Retry-After": String(daily.retryAfterSec) });
  if (!(await underDailyCap("live-conv", LIVE.globalConvsPerDay))) return json({ error: "busy" }, 503);

  const started = await startConversation(
    {
      name: m.name,
      email: m.email,
      org: m.org,
      message: m.message,
      page: m.page ?? "/",
      ipHash: key,
      via: "live",
    },
    deps,
  );
  if (!started.ok) return json({ error: "send_failed", fallback: "mailto" }, 502);
  return json({
    ok: true,
    c: started.conv.id,
    k: sign(started.conv.id),
    n: started.message.n,
    presence: await currentPresence(deps),
  });
}
