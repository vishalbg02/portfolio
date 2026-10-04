import { timingSafeEqual } from "node:crypto";
import { env, features } from "@/lib/env";
import { json } from "@/lib/http";
import { handleUpdate, type TelegramUpdate } from "@/lib/live/webhook";

export const maxDuration = 20;

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Telegram calls this for everything sent to the bot. It proves itself with the secret token set when the webhook was
 * registered; anything without it is refused. Valid updates always get a 200 (even for things we ignore), because
 * Telegram retries anything else.
 */
export async function POST(req: Request) {
  if (!features.live) return json({ error: "not_configured" }, 503);
  const secret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!same(secret, env.TELEGRAM_WEBHOOK_SECRET ?? "")) return json({ error: "forbidden" }, 401);
  const raw = await req.text();
  if (raw.length > 20_000) return json({ ok: true });
  let update: TelegramUpdate;
  try {
    update = JSON.parse(raw);
  } catch {
    return json({ ok: true });
  }
  if (typeof update?.update_id !== "number") return json({ ok: true });
  try {
    const action = await handleUpdate(update);
    console.info("[live]", JSON.stringify({ route: "telegram", action }));
  } catch (err) {
    console.error("[live] update failed:", (err as Error).message);
  }
  return json({ ok: true });
}
