import { validateMatchRequest } from "@/lib/ai/guards";
import { LIMITS } from "@/lib/ai/limits";
import { json, readBody, sameOrigin } from "@/lib/http";
import { runMatch } from "@/lib/match/run";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);

  const body = await readBody(req, LIMITS.bodyBytes);
  if (!body.ok) return json({ error: "too_large" }, 413);

  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const valid = validateMatchRequest(payload);
  if (!valid.ok) return json({ error: valid.error }, valid.status);

  const limit = await rateLimit({ scope: "match", ...LIMITS.matchRate }, clientKey(req.headers));
  if (!limit.ok)
    return json({ error: "rate_limited", retryAfterSec: limit.retryAfterSec }, 429, {
      "Retry-After": String(limit.retryAfterSec),
    });

  try {
    return json({ ...(await runMatch(valid.jd)) });
  } catch (err) {
    console.error("[ai] match failed:", (err as Error).message);
    return json({ error: "match_failed" }, 500);
  }
}
