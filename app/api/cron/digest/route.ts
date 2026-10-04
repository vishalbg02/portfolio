import { timingSafeEqual } from "node:crypto";
import { env, features } from "@/lib/env";
import { json } from "@/lib/http";
import { defaultDeps, statsText } from "@/lib/live/service";

export const maxDuration = 20;

/**
 * Vishal's daily digest in Telegram. Vercel's cron calls this once a day (see vercel.json) with
 * `Authorization: Bearer <CRON_SECRET>`; anything else is refused.
 */
export async function GET(req: Request) {
  const expected = `Bearer ${env.CRON_SECRET ?? ""}`;
  const given = req.headers.get("authorization") ?? "";
  const ok =
    Boolean(env.CRON_SECRET) &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return json({ error: "forbidden" }, 401);
  if (!features.live) return json({ ok: true, skipped: "not_configured" });
  const deps = defaultDeps();
  const sent = await deps.sendTelegram(`🌙 ${await statsText(deps, "Daily digest")}`);
  return json({ ok: sent.ok });
}
