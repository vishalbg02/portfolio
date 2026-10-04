import { Resend } from "resend";
import { env, features } from "@/lib/env";
import { FROM, sendOwnerEmail } from "@/lib/email/send";
import { ContactSchema } from "@/lib/contact/schema";
import { json, sameOrigin } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { canAutoReply, visitorEmail } from "@/lib/email/templates";

const MAX_BODY_BYTES = 10_000;

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

  const parsed = ContactSchema.safeParse(payload);
  if (!parsed.success) {
    // Honeypot filled → pretend success so bots learn nothing; anything else is a real validation error.
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

  const limit = await rateLimit({ scope: "contact", limit: 5, windowSec: 600 }, clientKey(req.headers));
  if (!limit.ok) return json({ error: "rate_limited" }, 429, { "Retry-After": String(limit.retryAfterSec) });

  if (!features.email) return json({ error: "not_configured", fallback: "mailto" }, 503);

  const submission = parsed.data;
  try {
    await sendOwnerEmail(submission);

    // The visitor's confirmation needs a sender on a verified domain; with the shared sender it is skipped.
    if (canAutoReply(process.env.CONTACT_FROM_EMAIL)) {
      const resend = new Resend(env.RESEND_API_KEY);
      const copy = visitorEmail(submission);
      const sent = await resend.emails
        .send({ from: FROM, to: submission.email, replyTo: env.CONTACT_TO_EMAIL!, ...copy })
        .catch((e: unknown) => ({ error: { message: (e as Error).message } }));
      if (sent.error) console.error("[contact] confirmation not sent:", sent.error.message); // never fails the request
    }
    return json({ ok: true });
  } catch (err) {
    console.error("[contact] send failed:", (err as Error).message);
    return json({ error: "send_failed", fallback: "mailto" }, 502);
  }
}
