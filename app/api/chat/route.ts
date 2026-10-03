import { chatEvents } from "@/lib/ai/chat";
import { validateChatRequest } from "@/lib/ai/guards";
import { LIMITS } from "@/lib/ai/limits";
import { encodeEvent } from "@/lib/ai/protocol";
import { getProvider } from "@/lib/ai/provider";
import { json, readBody, sameOrigin } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { corpusInfo, getRetriever } from "@/lib/rag/store";

export const maxDuration = 30;

/** Lets the UI show "AI online / offline mode" up front. Reveals no secrets. */
export function GET() {
  return json({
    ai: Boolean(getProvider()),
    vectors: getRetriever().hasVectors,
    chunks: corpusInfo().chunks,
  });
}

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

  const valid = validateChatRequest(payload);
  if (!valid.ok) return json({ error: valid.error }, valid.status);

  const limit = await rateLimit({ scope: "chat", ...LIMITS.chatRate }, clientKey(req.headers));
  if (!limit.ok)
    return json({ error: "rate_limited", retryAfterSec: limit.retryAfterSec }, 429, {
      "Retry-After": String(limit.retryAfterSec),
    });

  const events = chatEvents(valid.messages);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await events.next();
      if (done) controller.close();
      else controller.enqueue(encoder.encode(encodeEvent(value)));
    },
    async cancel() {
      await events.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
